use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::{Plant, Area};
use crate::commands::audit::record_audit;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlantPayload {
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlantPayload {
    pub id: String,
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAreaPayload {
    pub plant_id: String,
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAreaPayload {
    pub id: String,
    pub plant_id: Option<String>,
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
}

#[tauri::command]
pub async fn create_plant(
    pool: State<'_, SqlitePool>,
    payload: CreatePlantPayload,
) -> Result<Plant, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO plants (id, name, code, description, location)
         VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.code)
    .bind(&payload.description)
    .bind(&payload.location)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "plant", Some(&id), "create",
        &format!("Plant '{}' created", payload.name), None).await.ok();

    let plant = sqlx::query_as::<_, Plant>("SELECT * FROM plants WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(plant)
}

#[tauri::command]
pub async fn get_all_plants(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Plant>, String> {
    let plants = sqlx::query_as::<_, Plant>("SELECT * FROM plants ORDER BY created_at DESC")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(plants)
}

#[tauri::command]
pub async fn update_plant(
    pool: State<'_, SqlitePool>,
    payload: UpdatePlantPayload,
) -> Result<Plant, String> {
    sqlx::query(
        "UPDATE plants SET
            name = COALESCE(?1, name),
            code = COALESCE(?2, code),
            description = COALESCE(?3, description),
            location = COALESCE(?4, location)
         WHERE id = ?5"
    )
    .bind(&payload.name)
    .bind(&payload.code)
    .bind(&payload.description)
    .bind(&payload.location)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "plant", Some(&payload.id), "update",
        "Plant updated", None).await.ok();

    let plant = sqlx::query_as::<_, Plant>("SELECT * FROM plants WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(plant)
}

#[tauri::command]
pub async fn delete_plant(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM plants WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "plant", Some(&id), "delete",
        "Plant deleted", None).await.ok();
    Ok(())
}

#[tauri::command]
pub async fn create_area(
    pool: State<'_, SqlitePool>,
    payload: CreateAreaPayload,
) -> Result<Area, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO areas (id, plant_id, name, code, description)
         VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(&id)
    .bind(&payload.plant_id)
    .bind(&payload.name)
    .bind(&payload.code)
    .bind(&payload.description)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "area", Some(&id), "create",
        &format!("Area '{}' created", payload.name), None).await.ok();

    let area = sqlx::query_as::<_, Area>("SELECT * FROM areas WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(area)
}

#[tauri::command]
pub async fn get_areas_by_plant(
    pool: State<'_, SqlitePool>,
    plant_id: String,
) -> Result<Vec<Area>, String> {
    let areas = sqlx::query_as::<_, Area>(
        "SELECT * FROM areas WHERE plant_id = ?1 ORDER BY created_at DESC"
    )
    .bind(&plant_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(areas)
}

#[tauri::command]
pub async fn get_all_areas(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Area>, String> {
    let areas = sqlx::query_as::<_, Area>("SELECT * FROM areas ORDER BY created_at DESC")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(areas)
}

#[tauri::command]
pub async fn update_area(
    pool: State<'_, SqlitePool>,
    payload: UpdateAreaPayload,
) -> Result<Area, String> {
    sqlx::query(
        "UPDATE areas SET
            plant_id = COALESCE(?1, plant_id),
            name = COALESCE(?2, name),
            code = COALESCE(?3, code),
            description = COALESCE(?4, description)
         WHERE id = ?5"
    )
    .bind(&payload.plant_id)
    .bind(&payload.name)
    .bind(&payload.code)
    .bind(&payload.description)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "area", Some(&payload.id), "update",
        "Area updated", None).await.ok();

    let area = sqlx::query_as::<_, Area>("SELECT * FROM areas WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(area)
}

#[tauri::command]
pub async fn delete_area(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM areas WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "area", Some(&id), "delete",
        "Area deleted", None).await.ok();
    Ok(())
}
