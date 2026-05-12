use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::{Equipment, Downtime};



#[derive(Deserialize)]
pub struct CreateEquipmentPayload {
    pub tag_number : String,
    pub name : String,
    pub description : Option<String>,
    pub location : String,
    pub criticality : String,
    pub status : String,
    pub equipment_type : String,
    pub parent_id : Option<String>
}


// remember to call `.manage(MyState::default())`
#[tauri::command]
pub async fn create_equipment(
    pool: State<'_, SqlitePool>,
    payload: CreateEquipmentPayload,
) -> Result<Equipment, String> {
    let id = Uuid::new_v4().to_string();

   sqlx::query(
        "INSERT INTO equipment (id, tag_number, name, description, location, criticality, status, equipment_type, parent_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
    .bind(&id)
    .bind(&payload.tag_number)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.location)
    .bind(&payload.criticality)
    .bind(&payload.status)
    .bind(&payload.equipment_type)
    .bind(&payload.parent_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT * FROM equipment WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(equipment)
}



#[tauri::command]
pub async fn get_all_equipment(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Equipment>, String> {
    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT * FROM equipment ORDER BY created_at DESC"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(equipment)
    
}

#[tauri::command]
pub async fn get_equipment(
    pool: State<'_, SqlitePool>,
    id:String,
) -> Result<Equipment, String> {
    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT * FROM equipment WHERE id = ?1"
    ).bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(equipment)
}


#[derive(Deserialize)]
pub struct UpdateEquipmentPayload {
    pub id: String,
    pub tag_number: Option<String>,
    pub name : Option<String>,
    pub description : Option<String>,
    pub location : Option<String>,
    pub criticality : Option<String>,
    pub status : Option<String>,
    pub equipment_type : Option<String>
}


#[tauri::command]
pub async fn update_equipment (
    pool: State<'_, SqlitePool>,
    payload: UpdateEquipmentPayload,
) -> Result<Equipment, String> {
    sqlx::query(
        "UPDATE equipment SET
            tag_number = COALESCE(?1, tag_number),
            name = COALESCE(?2, name),
            description = COALESCE(?3, description),
            location = COALESCE(?4, location),
            criticality = COALESCE(?5, criticality),
            status = COALESCE(?6, status),
            equipment_type = COALESCE(?7, equipment_type),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?8"
    )
    .bind(&payload.tag_number)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.location)
    .bind(&payload.criticality)
    .bind(&payload.status)
    .bind(&payload.equipment_type)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT * FROM equipment WHERE id =?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(equipment)

}

#[tauri::command]
pub async fn delete_equipment(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
     sqlx::query(
        "DELETE FROM equipment WHERE id = ?1"
        ).bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}


#[derive(Deserialize)]
pub struct CreateDowntimePayload{
    pub equipment_id : String,
    pub title : String,
    pub description: Option<String>,
    pub loss_category: String,
    pub start_time: String,
    pub reported_by: Option<String>
}

#[tauri::command]
pub async fn create_downtime(
    pool: State<'_, SqlitePool>,
    payload: CreateDowntimePayload,
) -> Result<Downtime, String> {
    let id = Uuid::new_v4().to_string();

   sqlx::query(
        "INSERT INTO downtime (id, equipment_id, title, description, loss_category, start_time, reported_by)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(&id)
    .bind(&payload.equipment_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.loss_category)
    .bind(&payload.start_time)
    .bind(&payload.reported_by)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let result: Result<Downtime, sqlx::Error>= sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let downtime= result.map_err(|e: sqlx::Error| e.to_string())?;

    Ok(downtime)
}

#[tauri::command]
pub async fn get_equipment_downtime(
    pool: State<'_, SqlitePool>,
    equipment_id: String,
) -> Result<Vec<Downtime>, String> {
    let result: Result<Vec<Downtime>, sqlx::Error> = sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime WHERE equipment_id = ?1 ORDER BY created_at DESC"
    )
    .bind(&equipment_id)
    .fetch_all(&*pool)
    .await;

    let downtime = result.map_err(|e: sqlx::Error| e.to_string())?;

    Ok(downtime)  
}

#[tauri::command]
pub async fn close_downtime(
    pool: State<'_, SqlitePool>,
    id: String,
    end_time: String,
    duration_minutes: i64,
) -> Result<Downtime, String> {
     sqlx::query(
        "UPDATE downtime SET end_time = ?1, duration_minutes = ?2 WHERE id =?3"
        ).bind(&end_time)
        .bind(&duration_minutes)
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let result :Result<Downtime, sqlx::Error>= sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let downtime = result.map_err(|e: sqlx::Error| e.to_string())?;

    Ok(downtime)
}
