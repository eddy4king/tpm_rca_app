/*use tauri::State;
use sqlx::SqlitePool;
use std::env;
use dotenvy::dotenv;

/// Placeholder sync command – copies data from SQLite to PostgreSQL.
/// Returns a simple success message. Full row‑by‑row sync should be
/// implemented in future work.
#[tauri::command]
pub async fn sync_all(sqlite: State<'_, SqlitePool>) -> Result<String, String> {
    // Ensure environment vars are loaded – the actual sync logic is pending.
    dotenv().ok();
    let _pg_url = env::var("POSTGRES_URL").map_err(|e| format!("POSTGRES_URL not set: {}", e))?;
    // TODO: implement proper data migration using sqlx queries.
    Ok("Sync executed (placeholder)".to_string())
}
*/

use sqlx::{SqlitePool, postgres::PgPoolOptions};
use uuid::Uuid;
use crate::models::{
    SyncConfig, SyncLog,
    Equipment, Downtime, RcaInvestigation, RcaNode, CAPA, PmSchedule,
};

pub async fn get_sync_config(pool: &SqlitePool) -> Result<SyncConfig, String> {
    let result = sqlx::query_as::<_, SyncConfig>(
        "SELECT * FROM sync_config WHERE id = 'default'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result)
}

#[allow(dead_code)]
pub async fn log_change(
    pool: &SqlitePool,
    table_name: &str,
    record_id: &str,
    operation: &str,
    payload: &str,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sync_log (id, table_name, record_id, operation, payload, synced)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)"
    )
    .bind(&id)
    .bind(table_name)
    .bind(record_id)
    .bind(operation)
    .bind(payload)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn sync_to_postgres(pool: &SqlitePool) -> Result<String, String> {
    let config = get_sync_config(pool).await?;

    let postgres_url = config.postgres_url.ok_or("No PostgreSQL URL configured")?;

    let pg_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&postgres_url)
        .await
        .map_err(|e| format!("Failed to connect to PostgreSQL: {}", e))?;

    ensure_pg_tables(&pg_pool).await?;

    let unsynced: Vec<SyncLog> = sqlx::query_as::<_, SyncLog>(
        "SELECT * FROM sync_log WHERE synced = 0 ORDER BY created_at ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let total = unsynced.len();
    let mut success = 0;
    let mut failed = 0;

    for log in &unsynced {
        let result = apply_to_postgres(&pg_pool, log).await;
        match result {
            Ok(_) => {
                sqlx::query("UPDATE sync_log SET synced = 1, error = NULL WHERE id = ?1")
                    .bind(&log.id)
                    .execute(pool)
                    .await
                    .ok();
                success += 1;
            }
            Err(e) => {
                sqlx::query("UPDATE sync_log SET error = ?1 WHERE id = ?2")
                    .bind(&e)
                    .bind(&log.id)
                    .execute(pool)
                    .await
                    .ok();
                failed += 1;
            }
        }
    }

    sqlx::query(
        "UPDATE sync_config SET last_synced_at = CURRENT_TIMESTAMP WHERE id = 'default'"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Snapshot upsert: push the full current state of every table so that
    // records created before the change-log existed (or via paths that do not
    // write sync_log) still reach PostgreSQL. Upserts are idempotent.
    let snapshot = snapshot_push(pool, &pg_pool).await?;

    Ok(format!(
        "Sync complete: {} change-log rows succeeded, {} failed out of {}. Snapshot upserted {} rows.",
        success, failed, total, snapshot
    ))
}

/// Pushes the full contents of each local table to PostgreSQL using
/// idempotent upserts. Returns the number of rows upserted.
async fn snapshot_push(pool: &SqlitePool, pg_pool: &sqlx::PgPool) -> Result<usize, String> {
    let mut count = 0usize;

    macro_rules! push_table {
        ($model:ty, $table:literal) => {{
            let rows = sqlx::query_as::<_, $model>(concat!("SELECT * FROM ", $table))
                .fetch_all(pool)
                .await
                .map_err(|e| e.to_string())?;
            for row in &rows {
                let payload = serde_json::to_value(row).map_err(|e| e.to_string())?;
                let log = SyncLog {
                    id: String::new(),
                    table_name: $table.to_string(),
                    record_id: payload["id"].as_str().unwrap_or("").to_string(),
                    operation: "UPDATE".to_string(),
                    payload: payload.to_string(),
                    synced: 0,
                    error: None,
                    created_at: None,
                };
                if apply_to_postgres(pg_pool, &log).await.is_ok() {
                    count += 1;
                }
            }
        }};
    }

    push_table!(Equipment, "equipment");
    push_table!(Downtime, "downtime");
    push_table!(RcaInvestigation, "rca_investigations");
    push_table!(RcaNode, "rca_nodes");
    push_table!(CAPA, "capa");
    push_table!(PmSchedule, "pm_schedule");

    Ok(count)
}

pub async fn sync_from_postgres(pool: &SqlitePool) -> Result<String, String> {
    let config = get_sync_config(pool).await?;
    let postgres_url = config.postgres_url.ok_or("No PostgreSQL URL configured")?;

    let pg_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&postgres_url)
        .await
        .map_err(|e| format!("Failed to connect to PostgreSQL: {}", e))?;

    let last_synced = config.last_synced_at.unwrap_or_else(|| "1970-01-01".to_string());

    let tables = vec!["equipment", "downtime", "rca_investigations", "rca_nodes", "capa", "pm_schedule"];
    let mut total_pulled = 0;

    for table in tables {
        let query = format!(
            "SELECT row_to_json(t) as payload FROM {} t WHERE created_at > $1",
            table
        );

        let rows: Vec<(serde_json::Value,)> = sqlx::query_as(&query)
            .bind(&last_synced)
            .fetch_all(&pg_pool)
            .await
            .unwrap_or_default();

        for (payload,) in rows {
            let result = apply_to_sqlite(pool, table, &payload).await;
            if result.is_ok() {
                total_pulled += 1;
            }
        }
    }

    sqlx::query(
        "UPDATE sync_config SET last_synced_at = CURRENT_TIMESTAMP WHERE id = 'default'"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(format!("Pulled {} records from PostgreSQL", total_pulled))
}

async fn ensure_pg_tables(pg_pool: &sqlx::PgPool) -> Result<(), String> {
    let tables = vec![
        "CREATE TABLE IF NOT EXISTS equipment (
            id TEXT PRIMARY KEY, tag_number TEXT, name TEXT, description TEXT,
            location TEXT, criticality TEXT, status TEXT, equipment_type TEXT,
            parent_id TEXT, created_at TEXT, updated_at TEXT
        )",
        "CREATE TABLE IF NOT EXISTS downtime (
            id TEXT PRIMARY KEY, equipment_id TEXT, title TEXT, description TEXT,
            loss_category TEXT, start_time TEXT, end_time TEXT,
            duration_minutes BIGINT, reported_by TEXT, created_at TEXT
        )",
        "CREATE TABLE IF NOT EXISTS rca_investigations (
            id TEXT PRIMARY KEY, equipment_id TEXT, downtime_id TEXT,
            title TEXT, description TEXT, status TEXT, created_by TEXT,
            created_at TEXT, updated_at TEXT
        )",
        "CREATE TABLE IF NOT EXISTS rca_nodes (
            id TEXT PRIMARY KEY, investigation_id TEXT, parent_id TEXT,
            node_type TEXT, gate_type TEXT, title TEXT, description TEXT,
            x_pos FLOAT, y_pos FLOAT, created_at TEXT
        )",
        "CREATE TABLE IF NOT EXISTS capa (
            id TEXT PRIMARY KEY, investigation_id TEXT, title TEXT,
            owner TEXT, description TEXT, status TEXT, priority TEXT,
            due_date TEXT, created_at TEXT
        )",
        "CREATE TABLE IF NOT EXISTS pm_schedule (
            id TEXT PRIMARY KEY, equipment_id TEXT, title TEXT,
            description TEXT, frequency TEXT, next_due_date TEXT,
            last_completed_at TEXT, assigned_to TEXT, status TEXT,
            attachments TEXT, created_at TEXT
        )",
    ];

    for table_sql in tables {
        sqlx::query(table_sql)
            .execute(pg_pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    }
    Ok(())
}

async fn apply_to_postgres(pg_pool: &sqlx::PgPool, log: &SyncLog) -> Result<(), String> {
    let payload: serde_json::Value = serde_json::from_str(&log.payload)
        .map_err(|e| e.to_string())?;

    match log.operation.as_str() {
        "INSERT" | "UPDATE" => {
            let query = format!(
                "INSERT INTO {} SELECT * FROM json_populate_record(null::{}, $1::json)
                 ON CONFLICT (id) DO UPDATE SET {}",
                log.table_name,
                log.table_name,
                get_update_clause(&log.table_name)
            );
            sqlx::query(&query)
                .bind(payload.to_string())
                .execute(pg_pool)
                .await
                .map_err(|e| e.to_string())?;
        }
        "DELETE" => {
            let id = payload["id"].as_str().unwrap_or("");
            let query = format!("DELETE FROM {} WHERE id = $1", log.table_name);
            sqlx::query(&query)
                .bind(id)
                .execute(pg_pool)
                .await
                .map_err(|e| e.to_string())?;
        }
        _ => {}
    }
    Ok(())
}

/// Reads a JSON field as an owned `Option<String>`. Numbers/bools are
/// stringified so callers can bind them uniformly to TEXT/INTEGER columns.
fn js(payload: &serde_json::Value, key: &str) -> Option<String> {
    match &payload[key] {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

fn js_f64(payload: &serde_json::Value, key: &str) -> f64 {
    payload[key].as_f64().unwrap_or(0.0)
}

fn js_i64(payload: &serde_json::Value, key: &str) -> Option<i64> {
    payload[key].as_i64()
}

#[cfg(test)]
mod tests {
    use super::{js, js_f64, js_i64};
    use serde_json::json;

    #[test]
    fn js_reads_strings_and_stringifies_scalars() {
        let v = json!({ "name": "Pump", "count": 3, "flag": true, "missing": null });
        assert_eq!(js(&v, "name"), Some("Pump".to_string()));
        assert_eq!(js(&v, "count"), Some("3".to_string()));
        assert_eq!(js(&v, "flag"), Some("true".to_string()));
        assert_eq!(js(&v, "missing"), None);
        assert_eq!(js(&v, "absent"), None);
    }

    #[test]
    fn js_f64_defaults_to_zero() {
        let v = json!({ "x": 12.5, "y": "nope" });
        assert_eq!(js_f64(&v, "x"), 12.5);
        assert_eq!(js_f64(&v, "y"), 0.0);
        assert_eq!(js_f64(&v, "absent"), 0.0);
    }

    #[test]
    fn js_i64_parses_integers_only() {
        let v = json!({ "n": 42, "s": "7" });
        assert_eq!(js_i64(&v, "n"), Some(42));
        assert_eq!(js_i64(&v, "s"), None);
    }
}

/// Applies a record pulled from PostgreSQL into the local SQLite database.
///
/// Uses last-write-wins conflict resolution: for tables that carry an
/// `updated_at` column, an incoming row is only written when it is newer than
/// (or equal to) the local copy. Tables without `updated_at` are upserted via
/// `INSERT OR REPLACE`.
async fn apply_to_sqlite(
    pool: &SqlitePool,
    table: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let id = payload["id"].as_str().unwrap_or("").to_string();
    if id.is_empty() { return Ok(()); }

    // Last-write-wins guard for tables with an updated_at column.
    if matches!(table, "equipment" | "rca_investigations" | "capa") {
        if let Some(incoming) = js(payload, "updated_at") {
            let local: Option<String> = sqlx::query_scalar(
                &format!("SELECT updated_at FROM {} WHERE id = ?1", table)
            )
            .bind(&id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?
            .flatten();

            // If a local row exists and is newer, skip the incoming change.
            if let Some(local_ts) = local {
                if local_ts > incoming {
                    return Ok(());
                }
            }
        }
    }

    match table {
        "equipment" => {
            sqlx::query(
                "INSERT OR REPLACE INTO equipment
                 (id, tag_number, name, description, location, criticality, status,
                  equipment_type, parent_id, area_id, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"
            )
            .bind(&id)
            .bind(js(payload, "tag_number"))
            .bind(js(payload, "name"))
            .bind(js(payload, "description"))
            .bind(js(payload, "location"))
            .bind(js(payload, "criticality"))
            .bind(js(payload, "status"))
            .bind(js(payload, "equipment_type"))
            .bind(js(payload, "parent_id"))
            .bind(js(payload, "area_id"))
            .bind(js(payload, "created_at"))
            .bind(js(payload, "updated_at"))
            .execute(pool).await.map_err(|e| e.to_string())?;
        }
        "downtime" => {
            sqlx::query(
                "INSERT OR REPLACE INTO downtime
                 (id, equipment_id, title, description, loss_category, start_time,
                  end_time, duration_minutes, reported_by, created_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"
            )
            .bind(&id)
            .bind(js(payload, "equipment_id"))
            .bind(js(payload, "title"))
            .bind(js(payload, "description"))
            .bind(js(payload, "loss_category"))
            .bind(js(payload, "start_time"))
            .bind(js(payload, "end_time"))
            .bind(js_i64(payload, "duration_minutes"))
            .bind(js(payload, "reported_by"))
            .bind(js(payload, "created_at"))
            .execute(pool).await.map_err(|e| e.to_string())?;
        }
        "rca_investigations" => {
            sqlx::query(
                "INSERT OR REPLACE INTO rca_investigations
                 (id, downtime_id, equipment_id, title, description, status,
                  created_by, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)"
            )
            .bind(&id)
            .bind(js(payload, "downtime_id"))
            .bind(js(payload, "equipment_id"))
            .bind(js(payload, "title"))
            .bind(js(payload, "description"))
            .bind(js(payload, "status"))
            .bind(js(payload, "created_by"))
            .bind(js(payload, "created_at"))
            .bind(js(payload, "updated_at"))
            .execute(pool).await.map_err(|e| e.to_string())?;
        }
        "rca_nodes" => {
            sqlx::query(
                "INSERT OR REPLACE INTO rca_nodes
                 (id, investigation_id, parent_id, node_type, gate_type, title,
                  description, created_at, x_pos, y_pos)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"
            )
            .bind(&id)
            .bind(js(payload, "investigation_id"))
            .bind(js(payload, "parent_id"))
            .bind(js(payload, "node_type"))
            .bind(js(payload, "gate_type"))
            .bind(js(payload, "title"))
            .bind(js(payload, "description"))
            .bind(js(payload, "created_at"))
            .bind(js_f64(payload, "x_pos"))
            .bind(js_f64(payload, "y_pos"))
            .execute(pool).await.map_err(|e| e.to_string())?;
        }
        "capa" => {
            sqlx::query(
                "INSERT OR REPLACE INTO capa
                 (id, investigation_id, title, owner, description, status,
                  priority, due_date, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"
            )
            .bind(&id)
            .bind(js(payload, "investigation_id"))
            .bind(js(payload, "title"))
            .bind(js(payload, "owner"))
            .bind(js(payload, "description"))
            .bind(js(payload, "status"))
            .bind(js(payload, "priority"))
            .bind(js(payload, "due_date"))
            .bind(js(payload, "created_at"))
            .bind(js(payload, "updated_at"))
            .execute(pool).await.map_err(|e| e.to_string())?;
        }
        "pm_schedule" => {
            sqlx::query(
                "INSERT OR REPLACE INTO pm_schedule
                 (id, equipment_id, title, description, frequency, next_due_date,
                  last_completed_at, assigned_to, status, priority, attachments, created_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"
            )
            .bind(&id)
            .bind(js(payload, "equipment_id"))
            .bind(js(payload, "title"))
            .bind(js(payload, "description"))
            .bind(js(payload, "frequency"))
            .bind(js(payload, "next_due_date"))
            .bind(js(payload, "last_completed_at"))
            .bind(js(payload, "assigned_to"))
            .bind(js(payload, "status"))
            .bind(js(payload, "priority"))
            .bind(js(payload, "attachments"))
            .bind(js(payload, "created_at"))
            .execute(pool).await.map_err(|e| e.to_string())?;
        }
        _ => {
            // Unknown table – ignore rather than fail the whole pull.
            return Ok(());
        }
    }

    Ok(())
}

fn get_update_clause(table: &str) -> String {
    match table {
        "equipment" => "tag_number=EXCLUDED.tag_number, name=EXCLUDED.name, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at",
        "downtime" => "title=EXCLUDED.title, end_time=EXCLUDED.end_time, duration_minutes=EXCLUDED.duration_minutes",
        "rca_investigations" => "title=EXCLUDED.title, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at",
        "rca_nodes" => "title=EXCLUDED.title, description=EXCLUDED.description, x_pos=EXCLUDED.x_pos, y_pos=EXCLUDED.y_pos",
        "capa" => "title=EXCLUDED.title, status=EXCLUDED.status, owner=EXCLUDED.owner, due_date=EXCLUDED.due_date",
        "pm_schedule" => "title=EXCLUDED.title, status=EXCLUDED.status, next_due_date=EXCLUDED.next_due_date, last_completed_at=EXCLUDED.last_completed_at",
        _ => "id=EXCLUDED.id",
    }.to_string()
}