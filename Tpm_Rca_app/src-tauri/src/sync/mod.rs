use tauri::State;
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
