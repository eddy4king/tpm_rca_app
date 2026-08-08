use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::models::Photo;
use crate::session::{SessionState, enforce};
use crate::commands::audit::record_audit;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddPhotoPayload {
    pub record_type: String,
    pub record_id: String,
    pub caption: Option<String>,
    /// A base64 data URL (e.g. "data:image/png;base64,..."). */
    pub data: String,
}

#[tauri::command]
pub async fn add_photo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: AddPhotoPayload,
) -> Result<Photo, String> {
    enforce(&session, "Technician")?;

    if payload.data.trim().is_empty() {
        return Err("Photo data is empty".into());
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO photos (id, record_type, record_id, caption, data, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)",
    )
    .bind(&id)
    .bind(&payload.record_type)
    .bind(&payload.record_id)
    .bind(&payload.caption)
    .bind(&payload.data)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    record_audit(&pool, "photos", Some(&id), "create",
        &format!("Photo attached to {} {}", payload.record_type, payload.record_id), None).await.ok();

    Ok(photo)
}

#[tauri::command]
pub async fn get_photos(
    pool: State<'_, SqlitePool>,
    record_type: String,
    record_id: String,
) -> Result<Vec<Photo>, String> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE record_type = ?1 AND record_id = ?2 ORDER BY created_at ASC",
    )
    .bind(&record_type)
    .bind(&record_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(photos)
}

#[tauri::command]
pub async fn delete_photo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Technician")?;
    sqlx::query("DELETE FROM photos WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    record_audit(&pool, "photos", Some(&id), "delete", "Photo removed", None).await.ok();
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePhotoPayload {
    pub id: String,
    pub caption: Option<String>,
}

#[tauri::command]
pub async fn update_photo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpdatePhotoPayload,
) -> Result<Photo, String> {
    enforce(&session, "Technician")?;
    sqlx::query("UPDATE photos SET caption = ?1 WHERE id = ?2")
        .bind(&payload.caption)
        .bind(&payload.id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    let photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(photo)
}
