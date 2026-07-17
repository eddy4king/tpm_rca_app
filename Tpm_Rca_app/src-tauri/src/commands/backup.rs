use serde::Serialize;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::State;
use crate::session::{SessionState, enforce};

/// Tables whose data is copied during a restore. Session/sync/bookkeeping
/// tables are intentionally excluded so the current login stays valid and the
/// local sync configuration is preserved.
const RESTORABLE_TABLES: &[&str] = &[
    "plants",
    "areas",
    "equipment",
    "downtime",
    "rca_investigations",
    "rca_nodes",
    "capa",
    "pm_schedule",
    "audit_log",
    "users",
];

#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
}

/// Resolves the on-disk path of the primary SQLite database from `DATABASE_URL`,
/// mirroring the logic in `db::init`.
fn db_path() -> PathBuf {
    dotenvy::dotenv().ok();
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:C:/Users/edosa/project/tpm_rca.db".to_string());
    let raw = url
        .trim_start_matches("sqlite:")
        .trim_start_matches("//");
    PathBuf::from(raw)
}

/// Directory where backups are stored (a `backups` folder next to the DB file).
fn backups_dir() -> Result<PathBuf, String> {
    let db = db_path();
    let parent = db
        .parent()
        .ok_or_else(|| "Could not resolve database directory".to_string())?;
    let dir = parent.join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backups dir: {}", e))?;
    Ok(dir)
}

/// Escapes a filesystem path for safe inline use inside a single-quoted SQL
/// string literal.
fn sql_quote(path: &str) -> String {
    path.replace('\'', "''")
}

/// Creates a consistent, portable copy of the database using `VACUUM INTO`.
/// Returns the absolute path of the created backup file.
#[tauri::command]
pub async fn backup_database(pool: State<'_, SqlitePool>, session: State<'_, SessionState>) -> Result<String, String> {
    enforce(&session, "Admin")?;
    let dir = backups_dir()?;
    let stamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let dest = dir.join(format!("tpm_rca_backup_{}.db", stamp));
    let dest_str = dest.to_string_lossy().to_string();

    // VACUUM INTO does not accept bind parameters, so inline the escaped path.
    let sql = format!("VACUUM INTO '{}'", sql_quote(&dest_str));
    sqlx::query(&sql)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Backup failed: {}", e))?;

    crate::commands::audit::record_audit(
        &pool, "database", None, "backup",
        &format!("Backup created at {}", dest_str), None,
    ).await.ok();

    Ok(dest_str)
}

/// Lists all available backup files, newest first.
#[tauri::command]
pub async fn list_backups(session: State<'_, SessionState>) -> Result<Vec<BackupInfo>, String> {
    enforce(&session, "Admin")?;
    let dir = backups_dir()?;
    let mut backups: Vec<BackupInfo> = Vec::new();

    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("db") {
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            backups.push(BackupInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.len(),
            });
        }
    }

    // Sort by filename descending (timestamps make this newest-first).
    backups.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(backups)
}

/// Validates that a file at `path` is a usable backup and restores its data
/// into the live database. Data tables are replaced transactionally; the
/// current session and sync settings are left untouched.
#[tauri::command]
pub async fn restore_database(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    path: String,
) -> Result<String, String> {
    enforce(&session, "Admin")?;
    // Basic validation: the file must exist and be a SQLite database.
    let file = PathBuf::from(&path);
    if !file.exists() {
        return Err(format!("Backup file not found: {}", path));
    }

    let quoted = sql_quote(&path);

    // Attach the backup as a secondary schema for validation + copy.
    sqlx::query(&format!("ATTACH DATABASE '{}' AS backup", quoted))
        .execute(&*pool)
        .await
        .map_err(|e| format!("Not a valid SQLite backup: {}", e))?;

    // Ensure the backup actually contains our tables before touching live data.
    let tables: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM backup.sqlite_master WHERE type = 'table'",
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    let table_names: Vec<String> = tables.into_iter().map(|(n,)| n).collect();

    if !table_names.iter().any(|t| t == "equipment") {
        sqlx::query("DETACH DATABASE backup").execute(&*pool).await.ok();
        return Err("Selected file does not look like a TPM-RCA backup".into());
    }

    // Copy each restorable table inside a single transaction.
    let mut restored = 0;
    let result: Result<(), String> = async {
        sqlx::query("BEGIN").execute(&*pool).await.map_err(|e| e.to_string())?;
        for table in RESTORABLE_TABLES {
            if !table_names.iter().any(|t| t == table) {
                continue; // Table absent in this backup – skip.
            }
            sqlx::query(&format!("DELETE FROM main.{}", table))
                .execute(&*pool)
                .await
                .map_err(|e| e.to_string())?;
            sqlx::query(&format!(
                "INSERT INTO main.{0} SELECT * FROM backup.{0}",
                table
            ))
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
            restored += 1;
        }
        sqlx::query("COMMIT").execute(&*pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }
    .await;

    if let Err(e) = result {
        sqlx::query("ROLLBACK").execute(&*pool).await.ok();
        sqlx::query("DETACH DATABASE backup").execute(&*pool).await.ok();
        return Err(format!("Restore failed and was rolled back: {}", e));
    }

    sqlx::query("DETACH DATABASE backup").execute(&*pool).await.ok();

    crate::commands::audit::record_audit(
        &pool, "database", None, "restore",
        &format!("Database restored from {}", path), None,
    ).await.ok();

    Ok(format!("Restore complete: {} tables restored from backup", restored))
}

#[cfg(test)]
mod tests {
    use super::sql_quote;

    #[test]
    fn sql_quote_leaves_plain_paths_untouched() {
        assert_eq!(sql_quote("C:/data/db.sqlite"), "C:/data/db.sqlite");
    }

    #[test]
    fn sql_quote_doubles_single_quotes() {
        assert_eq!(sql_quote("O'Brien/backup.db"), "O''Brien/backup.db");
        assert_eq!(sql_quote("a'b'c"), "a''b''c");
    }
}
