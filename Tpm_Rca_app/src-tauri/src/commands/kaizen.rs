use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::models::{Area, KaizenSuggestion};
use crate::session::SessionState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKaizenPayload {
    pub title: String,
    pub description: Option<String>,
    pub submitted_by: Option<String>,
    pub area_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKaizenPayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub area_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetStatusPayload {
    pub id: String,
    pub status: String,
    pub implemented_by: Option<String>,
}

/// Lists Kaizen/CIP suggestions, optionally filtered by status and area.
#[tauri::command]
pub async fn list_kaizen(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    status: Option<String>,
    area_id: Option<String>,
) -> Result<Vec<KaizenSuggestion>, String> {
    crate::session::enforce(&session, "Viewer")?;
    let mut q = String::from("SELECT * FROM kaizen_suggestions WHERE 1=1");
    let mut binds: Vec<String> = Vec::new();
    if let Some(s) = &status {
        if !s.is_empty() {
            q.push_str(" AND status = ?");
            binds.push(s.clone());
        }
    }
    if let Some(a) = &area_id {
        if !a.is_empty() {
            q.push_str(" AND area_id = ?");
            binds.push(a.clone());
        }
    }
    q.push_str(" ORDER BY votes DESC, created_at DESC");
    let mut query = sqlx::query_as::<_, KaizenSuggestion>(&q);
    for b in &binds {
        query = query.bind(b);
    }
    query.fetch_all(&*pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_kaizen(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateKaizenPayload,
) -> Result<KaizenSuggestion, String> {
    crate::session::enforce(&session, "Viewer")?;
    if payload.title.trim().is_empty() {
        return Err("Title is required".to_string());
    }
    let id = Uuid::new_v4().to_string();
    let submitted_by = payload
        .submitted_by
        .filter(|s| !s.trim().is_empty())
        .or_else(|| session.current_user_id());
    sqlx::query(
        "INSERT INTO kaizen_suggestions (id, title, description, submitted_by, area_id, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'Submitted')",
    )
    .bind(&id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&submitted_by)
    .bind(&payload.area_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, KaizenSuggestion>("SELECT * FROM kaizen_suggestions WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_kaizen(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpdateKaizenPayload,
) -> Result<KaizenSuggestion, String> {
    crate::session::enforce(&session, "Engineer")?;
    let mut sets: Vec<String> = Vec::new();
    if payload.title.is_some() {
        sets.push("title = ?".to_string());
    }
    if payload.description.is_some() {
        sets.push("description = ?".to_string());
    }
    if payload.area_id.is_some() {
        sets.push("area_id = ?".to_string());
    }
    if sets.is_empty() {
        return Err("Nothing to update".to_string());
    }
    sets.push("updated_at = CURRENT_TIMESTAMP".to_string());
    let sql = format!(
        "UPDATE kaizen_suggestions SET {} WHERE id = ?",
        sets.join(", ")
    );
    let mut query = sqlx::query(&sql).bind(&payload.id);
    if let Some(t) = &payload.title {
        query = query.bind(t);
    }
    if let Some(d) = &payload.description {
        query = query.bind(d);
    }
    if let Some(a) = &payload.area_id {
        query = query.bind(a);
    }
    query.execute(&*pool).await.map_err(|e| e.to_string())?;

    sqlx::query_as::<_, KaizenSuggestion>("SELECT * FROM kaizen_suggestions WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_kaizen(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    crate::session::enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM kaizen_suggestions WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Advances a suggestion through the CIP workflow. When status becomes
/// "Implemented", `implemented_by` is recorded for operator recognition.
#[tauri::command]
pub async fn set_kaizen_status(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: SetStatusPayload,
) -> Result<KaizenSuggestion, String> {
    crate::session::enforce(&session, "Engineer")?;
    let implemented_by = if payload.status == "Implemented" {
        payload
            .implemented_by
            .filter(|s| !s.trim().is_empty())
            .or_else(|| session.current_user_id())
    } else {
        None
    };
    sqlx::query(
        "UPDATE kaizen_suggestions SET status = ?1, implemented_by = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
    )
    .bind(&payload.status)
    .bind(&implemented_by)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, KaizenSuggestion>("SELECT * FROM kaizen_suggestions WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())
}

/// Increments the vote count for a suggestion (operator recognition / priortisation).
#[tauri::command]
pub async fn vote_kaizen(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<KaizenSuggestion, String> {
    crate::session::enforce(&session, "Viewer")?;
    sqlx::query("UPDATE kaizen_suggestions SET votes = votes + 1 WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query_as::<_, KaizenSuggestion>("SELECT * FROM kaizen_suggestions WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())
}

/// Ranks production lines (areas) by OEE for the TPM culture leaderboard.
/// Availability is computed over a rolling 30-day planned window; performance
/// and quality are currently assumed at 100% (matching `get_oee_metrics`), so
/// OEE equals availability until those factors are captured per equipment.
#[tauri::command]
pub async fn get_oee_leaderboard(pool: State<'_, SqlitePool>) -> Result<Vec<Value>, String> {
    let areas = sqlx::query_as::<_, Area>("SELECT * FROM areas ORDER BY name")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let planned_window_min: i64 = 30 * 24 * 60;
    let mut rows: Vec<Value> = Vec::new();

    for area in &areas {
        let eq_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM equipment WHERE area_id = ?1")
            .bind(&area.id)
            .fetch_one(&*pool)
            .await
            .map_err(|e| e.to_string())?;
        if eq_count == 0 {
            continue;
        }
        let downtime: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(d.duration_minutes), 0)
             FROM downtime d JOIN equipment e ON e.id = d.equipment_id
             WHERE e.area_id = ?1",
        )
        .bind(&area.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        let planned = eq_count * planned_window_min;
        let availability = ((planned - downtime).max(0) as f64 / planned as f64) * 100.0;
        // OEE = availability × performance × quality; performance/quality are 100%.
        let oee = availability;

        rows.push(json!({
            "id": area.id,
            "name": area.name,
            "oee": oee.round() as i64,
            "availability": availability.round() as i64,
            "downtime_min": downtime,
            "equipment_count": eq_count,
        }));
    }

    rows.sort_by(|a, b| {
        let ao = a.get("oee").and_then(|v| v.as_i64()).unwrap_or(0);
        let bo = b.get("oee").and_then(|v| v.as_i64()).unwrap_or(0);
        bo.cmp(&ao)
    });

    Ok(rows)
}
