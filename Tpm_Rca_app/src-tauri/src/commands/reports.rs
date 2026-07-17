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

    let csv = build_report_csv(&pool, &sched.dataset).await?;
    let safe = sched.name.replace([' ', '/', '\\'], "_");
    let dir = std::path::Path::new("reports");
    let _ = std::fs::create_dir_all(dir);
    let fname = format!("{}/{}-{}.csv", dir.display(), safe, chrono::Utc::now().format("%Y%m%d%H%M%S"));
    std::fs::write(&fname, csv).map_err(|e| e.to_string())?;

    sqlx::query("UPDATE report_schedules SET last_run = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    notify(&pool, None, "report", "Scheduled report ready",
        &format!("Report '{}' ({}) generated: {}", sched.name, sched.dataset, fname), Some(&id)).await?;

    Ok(fname)
}
