use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::AuditLog;
use crate::session::{SessionState, enforce};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAuditPayload {
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub action: String,
    pub description: Option<String>,
    pub performed_by: Option<String>,
}

/// Inserts an audit record and returns its id. Safe to fire-and-forget from
/// other commands via `.await.ok()`.
pub async fn record_audit(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: Option<&str>,
    action: &str,
    description: &str,
    performed_by: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO audit_log (id, entity_type, entity_id, action, description, performed_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(&id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(action)
    .bind(description)
    .bind(performed_by)
    .execute(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn create_audit_log(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateAuditPayload,
) -> Result<AuditLog, String> {
    enforce(&session, "Engineer")?;
    let id = record_audit(
        &pool,
        &payload.entity_type,
        payload.entity_id.as_deref(),
        &payload.action,
        payload.description.as_deref().unwrap_or(""),
        payload.performed_by.as_deref(),
    ).await?;

    let log = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_log WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(log)
}

#[tauri::command]
pub async fn get_audit_logs(
    pool: State<'_, SqlitePool>,
    entity_type: Option<String>,
    entity_id: Option<String>,
    action: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<AuditLog>, String> {
    let mut clauses: Vec<&str> = Vec::new();
    if entity_type.is_some() { clauses.push("entity_type = ?"); }
    if entity_id.is_some() { clauses.push("entity_id = ?"); }
    if action.is_some() { clauses.push("action = ?"); }

    let mut sql = String::from("SELECT * FROM audit_log");
    if !clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ?");

    let mut q = sqlx::query_as::<_, AuditLog>(&sql);
    if let Some(v) = entity_type { q = q.bind(v); }
    if let Some(v) = entity_id { q = q.bind(v); }
    if let Some(v) = action { q = q.bind(v); }
    q = q.bind(limit.unwrap_or(500));

    q.fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}
