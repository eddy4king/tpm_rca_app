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
use crate::models::{SyncConfig, SyncLog};

pub async fn get_sync_config(pool: &SqlitePool) -> Result<SyncConfig, String> {
    let result = sqlx::query_as::<_, SyncConfig>(
        "SELECT * FROM sync_config WHERE id = 'default'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result)
}

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

    Ok(format!("Sync complete: {} succeeded, {} failed out of {} total", success, failed, total))
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

async fn apply_to_sqlite(
    pool: &SqlitePool,
    table: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let id = payload["id"].as_str().unwrap_or("").to_string();
    if id.is_empty() { return Ok(()); }

    let exists: bool = sqlx::query_scalar(
        &format!("SELECT EXISTS(SELECT 1 FROM {} WHERE id = ?1)", table)
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !exists {
        log_change(pool, table, &id, "INSERT", &payload.to_string()).await.ok();
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