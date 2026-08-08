use serde::Deserialize;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::ReportSchedule;
use crate::services::notifications::notify;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReportPayload {
    pub name: String,
    pub dataset: String,
    pub format: Option<String>,
    pub frequency: Option<String>,
    pub recipients: Option<String>,
}

fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_string()
    }
}

/// Builds a CSV string for the requested dataset.
async fn build_report_csv(pool: &SqlitePool, dataset: &str) -> Result<String, String> {
    match dataset {
        "workorders" => {
            let rows = sqlx::query("SELECT wo_number, title, status, priority, wo_type, assigned_to, due_date FROM work_orders ORDER BY created_at DESC")
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
            let mut s = String::from("wo_number,title,status,priority,type,assigned_to,due_date\n");
            for r in rows {
                let get = |c: &str| r.try_get::<String, _>(c).unwrap_or_default();
                s.push_str(&format!("{},{},{},{},{},{},{}\n",
                    csv_escape(&get("wo_number")), csv_escape(&get("title")),
                    csv_escape(&get("status")), csv_escape(&get("priority")),
                    csv_escape(&get("wo_type")), csv_escape(&get("assigned_to")),
                    csv_escape(&get("due_date"))));
            }
            Ok(s)
        }
        "timesheets" => {
            let rows = sqlx::query("SELECT l.person_name, l.minutes, l.rate, w.wo_number, w.title FROM wo_labor l JOIN work_orders w ON w.id = l.wo_id ORDER BY l.created_at DESC")
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
            let mut s = String::from("person,minutes,rate,wo_number,wo_title\n");
            for r in rows {
                let get = |c: &str| r.try_get::<String, _>(c).unwrap_or_default();
                let minutes: f64 = r.try_get("minutes").unwrap_or(0.0);
                let rate: Option<f64> = r.try_get("rate").ok().flatten();
                s.push_str(&format!("{},{},{},{},{}\n",
                    csv_escape(&get("person_name")), minutes, rate.unwrap_or(0.0),
                    csv_escape(&get("wo_number")), csv_escape(&get("title"))));
            }
            Ok(s)
        }
        "inventory" => {
            let rows = sqlx::query("SELECT part_number, name, category, qty_on_hand, reorder_level, unit_cost, location FROM inventory_items ORDER BY name")
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
            let mut s = String::from("part_number,name,category,qty_on_hand,reorder_level,unit_cost,location\n");
            for r in rows {
                let get = |c: &str| r.try_get::<String, _>(c).unwrap_or_default();
                let q: f64 = r.try_get("qty_on_hand").unwrap_or(0.0);
                let rl: f64 = r.try_get("reorder_level").unwrap_or(0.0);
                let uc: Option<f64> = r.try_get("unit_cost").ok().flatten();
                s.push_str(&format!("{},{},{},{},{},{},{}\n",
                    csv_escape(&get("part_number")), csv_escape(&get("name")),
                    csv_escape(&get("category")), q, rl, uc.unwrap_or(0.0),
                    csv_escape(&get("location"))));
            }
            Ok(s)
        }
        "audit" => {
            let rows = sqlx::query("SELECT entity_type, action, description, performed_by, created_at FROM audit_log ORDER BY created_at DESC LIMIT 1000")
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
            let mut s = String::from("entity_type,action,description,performed_by,created_at\n");
            for r in rows {
                let get = |c: &str| r.try_get::<String, _>(c).unwrap_or_default();
                let line = format!(
                    "{},{},{},{},{}\n",
                    csv_escape(&get("entity_type")),
                    csv_escape(&get("action")),
                    csv_escape(&get("description")),
                    csv_escape(&get("performed_by")),
                    csv_escape(&get("created_at"))
                );
                s.push_str(&line);
            }
            Ok(s)
        }
        other => Err(format!("Unknown dataset '{}'", other)),
    }
}

/// Writes the generated report to the `reports/` outbox and (optionally) emails
/// it to the schedule's recipients when an SMTP relay is configured. Email is
/// always best-effort: any failure is reported but never breaks the run.
async fn run_schedule_inner(pool: &SqlitePool, sched: &ReportSchedule) -> Result<String, String> {
    let csv = build_report_csv(pool, &sched.dataset).await?;
    let safe = sched.name.replace([' ', '/', '\\'], "_");
    let dir = std::path::Path::new("reports");
    let _ = std::fs::create_dir_all(dir);
    let fname = format!("{}/{}-{}.csv", dir.display(), safe, chrono::Utc::now().format("%Y%m%d%H%M%S"));
    std::fs::write(&fname, &csv).map_err(|e| e.to_string())?;

    sqlx::query("UPDATE report_schedules SET last_run = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(&sched.id)
        .execute(pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    // Best-effort email delivery.
    if let Some(recipients) = &sched.recipients {
        if !recipients.trim().is_empty() {
            if let Err(e) = deliver_report_email(recipients, &sched.name, &sched.dataset, &fname).await {
                eprintln!("report email delivery failed: {}", e);
            }
        }
    }

    notify(pool, None, "report", "Scheduled report ready",
        &format!("Report '{}' ({}) generated: {}", sched.name, sched.dataset, fname), Some(&sched.id)).await?;

    Ok(fname)
}

/// Number of days that must elapse before a schedule is considered due again.
fn frequency_days(frequency: &str) -> i64 {
    match frequency {
        "daily" => 1,
        "weekly" => 7,
        "monthly" => 30,
        _ => 7,
    }
}

/// Returns true when a schedule has never run or last ran longer ago than its
/// frequency interval.
fn is_due(sched: &ReportSchedule) -> bool {
    let due = frequency_days(&sched.frequency);
    match &sched.last_run {
        None => true,
        Some(lr) => {
            let elapsed = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(lr) {
                (chrono::Utc::now() - dt.with_timezone(&chrono::Utc)).num_days()
            } else if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(lr, "%Y-%m-%d %H:%M:%S") {
                (chrono::Utc::now().naive_utc() - naive).num_days()
            } else {
                return true;
            };
            elapsed >= due
        }
    }
}

/// Scans all report schedules and runs the ones that are due. Called by the
/// background scheduler so reports are delivered without manual intervention.
pub async fn run_due_reports(pool: &SqlitePool) -> Result<usize, String> {
    let scheds = sqlx::query_as::<_, ReportSchedule>("SELECT * FROM report_schedules")
        .fetch_all(pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    let mut ran = 0;
    for sched in scheds {
        if is_due(&sched) {
            if run_schedule_inner(pool, &sched).await.is_ok() {
                ran += 1;
            }
        }
    }
    Ok(ran)
}

#[tauri::command]
pub async fn create_report_schedule(
    pool: State<'_, SqlitePool>,
    session: State<'_, crate::session::SessionState>,
    payload: CreateReportPayload,
) -> Result<ReportSchedule, String> {
    crate::session::enforce(&session, "Engineer")?;
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO report_schedules (id, name, dataset, format, frequency, recipients) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.dataset)
    .bind(payload.format.clone().unwrap_or_else(|| "csv".into()))
    .bind(payload.frequency.clone().unwrap_or_else(|| "weekly".into()))
    .bind(&payload.recipients)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    sqlx::query_as::<_, ReportSchedule>("SELECT * FROM report_schedules WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_report_schedules(pool: State<'_, SqlitePool>) -> Result<Vec<ReportSchedule>, String> {
    sqlx::query_as::<_, ReportSchedule>("SELECT * FROM report_schedules ORDER BY created_at DESC")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn delete_report_schedule(
    pool: State<'_, SqlitePool>,
    session: State<'_, crate::session::SessionState>,
    id: String,
) -> Result<(), String> {
    crate::session::enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM report_schedules WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

/// Generates the report's CSV and records it as run (notifies the user).
#[tauri::command]
pub async fn run_report_schedule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<String, String> {
    let sched = sqlx::query_as::<_, ReportSchedule>("SELECT * FROM report_schedules WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    run_schedule_inner(&pool, &sched).await
}

/// Manual trigger for the background scheduler (runs every schedule that is due).
#[tauri::command]
pub async fn run_due_reports_cmd(
    pool: State<'_, SqlitePool>,
    session: State<'_, crate::session::SessionState>,
) -> Result<usize, String> {
    crate::session::enforce(&session, "Engineer")?;
    run_due_reports(&pool).await
}

// ---------------------------------------------------------------------------
// Best-effort SMTP delivery (no external crate; plaintext SMTP with optional
// AUTH PLAIN). Only runs when SMTP_HOST is configured. Failures are non-fatal.
// ---------------------------------------------------------------------------

fn b64(input: &[u8]) -> String {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD.encode(input)
}

/// Sends `attachment` (CSV) to each comma-separated recipient via a configured
/// SMTP relay. Returns Ok(()) when no relay is configured or on success; on a
/// relay error it returns Err but the caller treats delivery as best-effort.
async fn deliver_report_email(
    recipients: &str,
    name: &str,
    dataset: &str,
    file_path: &str,
) -> Result<(), String> {
    let host = match std::env::var("SMTP_HOST") {
        Ok(h) if !h.trim().is_empty() => h,
        _ => return Ok(()),
    };
    let port: u16 = std::env::var("SMTP_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(25);
    let from = std::env::var("SMTP_FROM").unwrap_or_else(|_| "tpm-rca@localhost".into());
    let user = std::env::var("SMTP_USER").ok().filter(|s| !s.is_empty());
    let pass = std::env::var("SMTP_PASS").ok().filter(|s| !s.is_empty());

    let body = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let attachment_name = format!("{}-{}.csv", name.replace([' ', '/', '\\'], "_"), dataset);

    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpStream;

    let stream = TcpStream::connect((host.clone(), port)).await.map_err(|e| e.to_string())?;
    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);

    async fn read_reply(reader: &mut BufReader<tokio::net::tcp::OwnedReadHalf>) -> Result<String, String> {
        let mut full = String::new();
        loop {
            let mut line = String::new();
            reader.read_line(&mut line).await.map_err(|e| e.to_string())?;
            if line.is_empty() { break; }
            full.push_str(&line);
            // Final reply line has a space after the 3-digit code.
            let code = line.get(0..3).unwrap_or("");
            if line.get(3..4) == Some(" ") {
                if !code.starts_with('2') && !code.starts_with('3') {
                    return Err(format!("SMTP error: {}", full.trim()));
                }
                break;
            }
        }
        Ok(full)
    }

    async fn send(
        write_half: &mut tokio::net::tcp::OwnedWriteHalf,
        reader: &mut BufReader<tokio::net::tcp::OwnedReadHalf>,
        cmd: &str,
    ) -> Result<(), String> {
        write_half.write_all(cmd.as_bytes()).await.map_err(|e| e.to_string())?;
        write_half.flush().await.map_err(|e| e.to_string())?;
        read_reply(reader).await?;
        Ok(())
    }

    read_reply(&mut reader).await?; // greeting
    send(&mut write_half, &mut reader, &format!("EHLO tpm-rca\r\n")).await?;

    if let (Some(u), Some(p)) = (user, pass) {
        let auth = b64(format!("\0{}\0{}", u, p).as_bytes());
        send(&mut write_half, &mut reader, &format!("AUTH PLAIN {}\r\n", auth)).await?;
    }

    send(&mut write_half, &mut reader, &format!("MAIL FROM:<{}>\r\n", from)).await?;
    for rcpt in recipients.split(',') {
        let rcpt = rcpt.trim();
        if !rcpt.is_empty() {
            send(&mut write_half, &mut reader, &format!("RCPT TO:<{}>\r\n", rcpt)).await?;
        }
    }

    send(&mut write_half, &mut reader, "DATA\r\n").await?;
    let boundary = "TPMRCA_BOUNDARY_2024";
    let msg = format!(
        "From: {from}\r\nSubject: Scheduled report: {name}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"{boundary}\"\r\n\r\n--{boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlease find the attached scheduled report '{name}' ({dataset}).\r\n--{boundary}\r\nContent-Type: text/csv; name=\"{attachment_name}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{attachment_name}\"\r\n\r\n{b64data}\r\n--{boundary}--\r\n.\r\n",
        from = from,
        name = name,
        dataset = dataset,
        boundary = boundary,
        attachment_name = attachment_name,
        b64data = b64(body.as_bytes()),
    );
    send(&mut write_half, &mut reader, &msg).await?;
    send(&mut write_half, &mut reader, "QUIT\r\n").await?;
    Ok(())
}
