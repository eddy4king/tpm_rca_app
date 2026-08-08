use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::{Equipment, Downtime, RcaInvestigation, RcaNode, CAPA, PmSchedule};


use crate::sync::{sync_to_postgres, sync_from_postgres, get_sync_config};
use bcrypt::{hash, verify, DEFAULT_COST};
use crate::models::SafeUser;
use crate::models::User;
use crate::models::Session;
use crate::commands::audit::record_audit;
use crate::session::{SessionState, enforce};
use crate::models::FmeaRow;
pub mod role;
pub mod audit;
pub mod hierarchy;
pub mod timeline;
pub mod knowledge;
pub mod photos;
pub mod reports;
pub mod production;
pub mod kaizen;
pub mod backup;
pub mod inventory;
pub mod notifications;
pub mod workorders;
pub mod import;
pub use import::import_equipment_csv;

#[tauri::command]
pub async fn export_peer_snapshot(
    pool: State<'_, SqlitePool>,
    path: String,
) -> Result<String, String> {
    crate::sync::export_peer_snapshot(&pool, path).await
}

#[tauri::command]
pub async fn merge_peer_database(
    pool: State<'_, SqlitePool>,
    peer_path: String,
) -> Result<String, String> {
    crate::sync::merge_peer_database(&pool, peer_path).await
}

#[tauri::command]
pub fn discover_peers(timeout_ms: i64) -> Result<Vec<String>, String> {
    crate::sync::discover_peers(timeout_ms)
}


#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEquipmentPayload {
    pub tag_number : String,
    pub name : String,
    pub description : Option<String>,
    pub location : String,
    pub criticality : String,
    pub status : String,
    pub equipment_type : String,
    pub parent_id : Option<String>,
    pub area_id : Option<String>
}


// remember to call `.manage(MyState::default())`
#[tauri::command]
pub async fn create_equipment(
    pool: State<'_, SqlitePool>,
    payload: CreateEquipmentPayload,
) -> Result<Equipment, String> {
    let id = Uuid::new_v4().to_string();

   sqlx::query(
        "INSERT INTO equipment (id, tag_number, name, description, location, criticality, status, equipment_type, parent_id, area_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
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
    .bind(&payload.area_id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "equipment", Some(&id), "create",
        &format!("Equipment '{}' ({}) created", payload.name, payload.tag_number), None).await.ok();

    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT * FROM equipment WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

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
    .map_err(|e: sqlx::Error| e.to_string())?;

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
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(equipment)
}


#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEquipmentPayload {
    pub id: String,
    pub tag_number: Option<String>,
    pub name : Option<String>,
    pub description : Option<String>,
    pub location : Option<String>,
    pub criticality : Option<String>,
    pub status : Option<String>,
    pub equipment_type : Option<String>,
    pub area_id : Option<String>
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
            area_id = COALESCE(?8, area_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?9"
    )
    .bind(&payload.tag_number)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.location)
    .bind(&payload.criticality)
    .bind(&payload.status)
    .bind(&payload.equipment_type)
    .bind(&payload.area_id)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "equipment", Some(&payload.id), "update",
        &format!("Equipment '{}' updated", payload.name.clone().unwrap_or_default()), None).await.ok();

    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT * FROM equipment WHERE id =?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

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
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "equipment", Some(&id), "delete",
        "Equipment deleted", None).await.ok();
    Ok(())
}


#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<Downtime, sqlx::Error>= sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let downtime= result.map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "downtime", Some(&id), "create",
        &format!("Downtime '{}' logged", payload.title), payload.reported_by.as_deref()).await.ok();

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
        .map_err(|e: sqlx::Error| e.to_string())?;

    let result :Result<Downtime, sqlx::Error>= sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let downtime = result.map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "downtime", Some(&id), "close",
        "Downtime event closed", None).await.ok();

    Ok(downtime)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvestigationPayload {
    pub equipment_id: String,
    pub downtime_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRcaNodePayload {
    pub investigation_id: String,
    pub parent_id: Option<String>,
    pub node_type: String,
    pub gate_type: Option<String>,
    pub title: String,
    pub description: Option<String>,
}


#[tauri::command]
pub async fn create_investigation(
    pool: State<'_, SqlitePool>,
    payload: CreateInvestigationPayload,
) -> Result<RcaInvestigation, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO rca_investigations (id, downtime_id, equipment_id, title, description, status, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(&id)
    .bind(&payload.downtime_id)
    .bind(&payload.equipment_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind("Open")
    .bind(&payload.created_by)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<RcaInvestigation, sqlx::Error> = sqlx::query_as::<_, RcaInvestigation>(
        "SELECT * FROM rca_investigations WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let investigation = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(investigation)
}

#[tauri::command]
pub async fn get_investigations(
    pool: State<'_, SqlitePool>,
    equipment_id: String,
) -> Result<Vec<RcaInvestigation>, String>{
      let result: Result<Vec<RcaInvestigation>, sqlx::Error> = sqlx::query_as::<_, RcaInvestigation>(
        "SELECT * FROM rca_investigations WHERE equipment_id = ?1 ORDER BY created_at DESC"
    )
    .bind(&equipment_id)
    .fetch_all(&*pool)
    .await;

    let investigation = result.map_err(|e: sqlx::Error| e.to_string())?;

    Ok(investigation) 
}

#[tauri::command]
pub async fn add_rca_node(
    pool: State<'_, SqlitePool>,
    payload: AddRcaNodePayload,
) -> Result<RcaNode, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO rca_nodes (id, investigation_id, parent_id, node_type,gate_type, title, description, x_pos, y_pos)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
    .bind(&id)
    .bind(&payload.investigation_id)
    .bind(&payload.parent_id)
    .bind(&payload.node_type)
    .bind(&payload.gate_type)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(0.0_f64)
    .bind(0.0_f64)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<RcaNode, sqlx::Error> = sqlx::query_as::<_, RcaNode>(
        "SELECT * FROM rca_nodes WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let node = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(node)
}
    
#[tauri::command]
pub async fn get_investigation_nodes(
    pool: State<'_, SqlitePool>,
    investigation_id: String,
) -> Result<Vec<RcaNode>, String>{
    let result: Result<Vec<RcaNode>, sqlx::Error> = sqlx::query_as::<_, RcaNode>(
        "SELECT * FROM rca_nodes WHERE investigation_id = ?1 ORDER BY created_at ASC"
    )
    .bind(&investigation_id)
    .fetch_all(&*pool)
    .await;

    let node = result.map_err(|e: sqlx::Error| e.to_string())?;

    Ok(node) 
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDowntimePayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub loss_category: Option<String>,
    pub start_time: Option<String>,
    pub reported_by: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvestigationPayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[tauri::command]
pub async fn update_downtime(
    pool: State<'_, SqlitePool>,
    payload: UpdateDowntimePayload,
) -> Result<Downtime, String> {
    sqlx::query(
        "UPDATE downtime SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            loss_category = COALESCE(?3, loss_category),
            start_time = COALESCE(?4, start_time),
            reported_by = COALESCE(?5, reported_by)
         WHERE id = ?6"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.loss_category)
    .bind(&payload.start_time)
    .bind(&payload.reported_by)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<Downtime, sqlx::Error> = sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let downtime = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(downtime)
}

#[tauri::command]
pub async fn delete_downtime(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM downtime WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "downtime", Some(&id), "delete",
        "Downtime event deleted", None).await.ok();
    Ok(()) 
}

#[tauri::command]
pub async fn update_investigation(
    pool: State<'_, SqlitePool>,
    payload: UpdateInvestigationPayload,
) -> Result<RcaInvestigation, String> {
    sqlx::query(
        "UPDATE rca_investigations SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            status = COALESCE(?3, status),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?4"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.status)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<RcaInvestigation, sqlx::Error> = sqlx::query_as::<_, RcaInvestigation>(
        "SELECT * FROM rca_investigations WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let investigation = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(investigation)
}

#[tauri::command]
pub async fn delete_investigation(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM rca_investigations WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_rca_node(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM rca_nodes WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_node_position(
    pool: State<'_, SqlitePool>,
    id: String,
    x_pos: f64,
    y_pos: f64,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE rca_nodes SET x_pos = ?1, y_pos = ?2 WHERE id = ?3"
    )
    .bind(x_pos)
    .bind(y_pos)
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_all_downtime(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Downtime>, String> {
    let result: Result<Vec<Downtime>, sqlx::Error> = sqlx::query_as::<_, Downtime>(
        "SELECT * FROM downtime ORDER BY created_at DESC"
    )
    .fetch_all(&*pool)
    .await;

    let downtime = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(downtime)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRcaNodePayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub node_type: Option<String>,
    pub gate_type: Option<String>,
}

#[tauri::command]
pub async fn update_rca_node(
    pool: State<'_, SqlitePool>,
    payload: UpdateRcaNodePayload,
) -> Result<RcaNode, String> {
    sqlx::query(
        "UPDATE rca_nodes SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            node_type = COALESCE(?3, node_type),
            gate_type = COALESCE(?4, gate_type)
         WHERE id = ?5"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.node_type)
    .bind(&payload.gate_type)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<RcaNode, sqlx::Error> = sqlx::query_as::<_, RcaNode>(
        "SELECT * FROM rca_nodes WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let node = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(node)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCapaPayload{
    pub investigation_id: Option<String>,
    pub title: Option<String>,
    pub owner: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCapaPayload{
    pub id: String,
    pub investigation_id: Option<String>,
    pub title: Option<String>,
    pub owner: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>
}

//under construction
#[tauri::command]
pub async fn create_capa(
    pool: State<'_, SqlitePool>,
    payload: CreateCapaPayload,
) -> Result<CAPA, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO capa (id, investigation_id, title, owner, description, status,priority, due_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
    .bind(&id)
    .bind(&payload.investigation_id)
    .bind(&payload.title)
    .bind(&payload.owner)
    .bind(&payload.description)
        .bind("Open")
        .bind(&payload.priority)
        .bind(&payload.due_date)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "capa", Some(&id), "create",
        &format!("CAPA '{}' created", payload.title.clone().unwrap_or_default()), None).await.ok();

    let result: Result<CAPA, sqlx::Error> = sqlx::query_as::<_, CAPA>(
        "SELECT * FROM capa WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let capas = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(capas)
}

#[tauri::command]
pub async fn get_investigation_capas(
    pool: State<'_, SqlitePool>,
    investigation_id: String,
) -> Result<Vec<CAPA>, String>{
    let result: Result<Vec<CAPA>, sqlx::Error> = sqlx::query_as::<_, CAPA>(
        "SELECT * FROM capa WHERE investigation_id = ?1 ORDER BY created_at DESC"
    )
    .bind(&investigation_id)
    .fetch_all(&*pool)
    .await;

    let capas = result.map_err(|e: sqlx::Error| e.to_string())?;

    Ok(capas) 
}

#[tauri::command]
pub async fn update_capa(
    pool: State<'_, SqlitePool>,
    payload: UpdateCapaPayload,
) -> Result<CAPA, String> {
    sqlx::query(
        "UPDATE capa SET
            investigation_id = COALESCE(?1, investigation_id),
            title = COALESCE(?2, title),
            owner = COALESCE(?3, owner),
            description = COALESCE(?4, description),
            status = COALESCE(?5, status),
            priority = COALESCE(?6, priority),
            due_date = COALESCE(?7, due_date)
         WHERE id = ?8"
    )
    .bind(&payload.investigation_id)
    .bind(&payload.title)
    .bind(&payload.owner)
    .bind(&payload.description)
    .bind(&payload.status)
    .bind(&payload.priority)
    .bind(&payload.due_date)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<CAPA, sqlx::Error> = sqlx::query_as::<_, CAPA>(
        "SELECT * FROM capa WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let capas = result.map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "capa", Some(&payload.id), "update",
        &format!("CAPA '{}' updated", payload.title.clone().unwrap_or_default()), None).await.ok();

    Ok(capas)
}
#[tauri::command]
pub async fn delete_capa(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM capa WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "capa", Some(&id), "delete",
        "CAPA deleted", None).await.ok();
    Ok(())
}


#[tauri::command]
pub async fn get_all_capas(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<CAPA>, String> {
    let result: Result<Vec<CAPA>, sqlx::Error> = sqlx::query_as::<_, CAPA>(
        "SELECT * FROM capa ORDER BY created_at DESC"
    )
    .fetch_all(&*pool)
    .await;

    let capas = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(capas)
}


#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePmSchedulePayload {
    pub equipment_id: String,
    pub title: String,
    pub description: Option<String>,
    pub frequency: String,
    pub next_due_date: Option<String>,
    pub assigned_to: Option<String>,
    pub attachments: Option<String>,
    pub priority: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePmSchedulePayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub frequency: Option<String>,
    pub next_due_date: Option<String>,
    pub last_completed_at: Option<String>,
    pub assigned_to: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub attachments: Option<String>,
}

#[tauri::command]
pub async fn create_pm_schedule(
    pool: State<'_, SqlitePool>,
    payload: CreatePmSchedulePayload,
) -> Result<PmSchedule, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO pm_schedule (id, equipment_id, title, description, frequency, next_due_date, assigned_to, status, attachments, priority)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
    )
    .bind(&id)
    .bind(&payload.equipment_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.frequency)
    .bind(&payload.next_due_date)
    .bind(&payload.assigned_to)
    .bind("Pending")
    .bind(&payload.attachments)
    .bind(&payload.priority)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "pm_schedule", Some(&id), "create",
        &format!("PM task '{}' created", payload.title), payload.assigned_to.as_deref()).await.ok();

    let result: Result<PmSchedule, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let schedule = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(schedule)
}

#[tauri::command]
pub async fn get_equipment_pm_schedules(
    pool: State<'_, SqlitePool>,
    equipment_id: String,
) -> Result<Vec<PmSchedule>, String> {
    let result: Result<Vec<PmSchedule>, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule WHERE equipment_id = ?1 ORDER BY next_due_date ASC"
    )
    .bind(&equipment_id)
    .fetch_all(&*pool)
    .await;

    let schedules = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(schedules)
}

#[tauri::command]
pub async fn get_all_pm_schedules(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<PmSchedule>, String> {
    let result: Result<Vec<PmSchedule>, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule ORDER BY next_due_date ASC"
    )
    .fetch_all(&*pool)
    .await;

    let schedules = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(schedules)
}

#[tauri::command]
pub async fn update_pm_schedule(
    pool: State<'_, SqlitePool>,
    payload: UpdatePmSchedulePayload,
) -> Result<PmSchedule, String> {
    sqlx::query(
        "UPDATE pm_schedule SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            frequency = COALESCE(?3, frequency),
            next_due_date = COALESCE(?4, next_due_date),
            last_completed_at = COALESCE(?5, last_completed_at),
            assigned_to = COALESCE(?6, assigned_to),
            status = COALESCE(?7, status),
            priority = COALESCE(?8, priority),
            attachments = COALESCE(?9, attachments)
         WHERE id = ?10"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.frequency)
    .bind(&payload.next_due_date)
    .bind(&payload.last_completed_at)
    .bind(&payload.assigned_to)
    .bind(&payload.status)
    .bind(&payload.priority)
    .bind(&payload.attachments)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "pm_schedule", Some(&payload.id), "update",
        &format!("PM task '{}' updated", payload.title.clone().unwrap_or_default()), None).await.ok();

    let result: Result<PmSchedule, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let schedule = result.map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "pm_schedule", Some(&payload.id), "complete",
        "PM task marked complete", None).await.ok();

    Ok(schedule)
}

#[tauri::command]
pub async fn delete_pm_schedule(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM pm_schedule WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "pm_schedule", Some(&id), "delete",
        "PM task deleted", None).await.ok();
    Ok(())
}

#[tauri::command]
pub async fn complete_pm_schedule(
    pool: State<'_, SqlitePool>,
    id: String,
    completed_at: String,
    next_due_date: String,
) -> Result<PmSchedule, String> {
    sqlx::query(
        "UPDATE pm_schedule SET
            status = 'Completed',
            last_completed_at = ?1,
            next_due_date = ?2
         WHERE id = ?3"
    )
    .bind(&completed_at)
    .bind(&next_due_date)
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let result: Result<PmSchedule, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let schedule = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(schedule)
}



#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSyncConfigPayload {
    pub postgres_url: Option<String>,
    pub auto_sync: Option<i64>,
    pub sync_interval_minutes: Option<i64>,
}

#[tauri::command]
pub async fn get_sync_config_cmd(
    pool: State<'_, SqlitePool>,
) -> Result<crate::models::SyncConfig, String> {
    get_sync_config(&pool).await
}

#[tauri::command]
pub async fn update_sync_config(
    pool: State<'_, SqlitePool>,
    payload: UpdateSyncConfigPayload,
) -> Result<crate::models::SyncConfig, String> {
    sqlx::query(
        "UPDATE sync_config SET
            postgres_url = COALESCE(?1, postgres_url),
            auto_sync = COALESCE(?2, auto_sync),
            sync_interval_minutes = COALESCE(?3, sync_interval_minutes)
         WHERE id = 'default'"
    )
    .bind(&payload.postgres_url)
    .bind(&payload.auto_sync)
    .bind(&payload.sync_interval_minutes)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    get_sync_config(&pool).await
}

#[tauri::command]
pub async fn push_to_postgres(
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    sync_to_postgres(&pool).await
}

#[tauri::command]
pub async fn pull_from_postgres(
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    sync_from_postgres(&pool).await
}

#[tauri::command]
pub async fn test_postgres_connection(
    postgres_url: String,
) -> Result<String, String> {
    let pg_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect(&postgres_url)
        .await
        .map_err(|e: sqlx::Error| format!("Connection failed: {}", e))?;

    sqlx::query("SELECT 1")
        .execute(&pg_pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    Ok("Connection successful".to_string())
}

#[tauri::command]
pub async fn get_sync_logs(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<crate::models::SyncLog>, String> {
    let result = sqlx::query_as::<_, crate::models::SyncLog>(
        "SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 100"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(result)
}



#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterPayload {
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserPayload {
    pub id: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<i64>,
}

#[tauri::command]
pub async fn register_user(
    pool: State<'_, SqlitePool>,
    payload: RegisterPayload,
) -> Result<SafeUser, String> {
    let id = Uuid::new_v4().to_string();
    let password_hash = hash(&payload.password, DEFAULT_COST)
        .map_err(|e| e.to_string())?;
    let role = payload.role.unwrap_or_else(|| "Viewer".to_string());

    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)"
    )
    .bind(&id)
    .bind(&payload.username)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&role)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(SafeUser {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
    })
}

#[tauri::command]
pub async fn login_user(
    pool: State<'_, SqlitePool>,
    payload: LoginPayload,
) -> Result<(SafeUser, String), String> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?1 AND is_active = 1"
    )
    .bind(&payload.username)
    .fetch_one(&*pool)
    .await
    .map_err(|_| "Invalid username or password".to_string())?;

    let valid = verify(&payload.password, &user.password_hash)
        .map_err(|e| e.to_string())?;

    if !valid {
        return Err("Invalid username or password".to_string());
    }

    // Create session token
    let session_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap()
        .to_rfc3339();

    sqlx::query(
        "INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES (?1, ?2, ?3, ?4)"
    )
    .bind(&session_id)
    .bind(&user.id)
    .bind(&token)
    .bind(&expires_at)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    // Update last login
    sqlx::query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(&user.id)
        .execute(&*pool)
        .await
        .ok();

    let safe_user = SafeUser {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
    };

    Ok((safe_user, token))
}

#[tauri::command]
pub async fn logout_user(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM sessions WHERE token = ?1")
        .bind(&token)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn validate_session(
    pool: State<'_, SqlitePool>,
    token: String,
) -> Result<SafeUser, String> {
    let session = sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE token = ?1"
    )
    .bind(&token)
    .fetch_one(&*pool)
    .await
    .map_err(|_| "Invalid or expired session".to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    if session.expires_at < now {
        sqlx::query("DELETE FROM sessions WHERE token = ?1")
            .bind(&token)
            .execute(&*pool)
            .await
            .ok();
        return Err("Session expired".to_string());
    }

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = ?1 AND is_active = 1"
    )
    .bind(&session.user_id)
    .fetch_one(&*pool)
    .await
    .map_err(|_| "User not found".to_string())?;

    Ok(SafeUser {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
    })
}

#[tauri::command]
pub async fn get_all_users(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<SafeUser>, String> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users ORDER BY created_at DESC"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(users.into_iter().map(|u| SafeUser {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
    }).collect())
}

#[tauri::command]
pub async fn update_user(
    pool: State<'_, SqlitePool>,
    payload: UpdateUserPayload,
) -> Result<SafeUser, String> {
    sqlx::query(
        "UPDATE users SET
            username = COALESCE(?1, username),
            email = COALESCE(?2, email),
            role = COALESCE(?3, role),
            is_active = COALESCE(?4, is_active)
         WHERE id = ?5"
    )
    .bind(&payload.username)
    .bind(&payload.email)
    .bind(&payload.role)
    .bind(&payload.is_active)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(SafeUser {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
    })
}

#[tauri::command]
pub async fn delete_user(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM users WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn setup_admin(
    pool: State<'_, SqlitePool>,
    username: String,
    email: String,
    password: String,
) -> Result<SafeUser, String> {
    // Only works if no users exist yet
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    if count > 0 {
        return Err("Setup already complete. Use login instead.".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let password_hash = hash(&password, DEFAULT_COST)
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, is_active)
         VALUES (?1, ?2, ?3, ?4, 'Admin', 1)"
    )
    .bind(&id)
    .bind(&username)
    .bind(&email)
    .bind(&password_hash)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(SafeUser {
        id,
        username,
        email,
        role: "Admin".to_string(),
        is_active: 1,
        created_at: None,
        last_login_at: None,
    })
}

#[tauri::command]
pub async fn has_users(
    pool: State<'_, SqlitePool>,
) -> Result<bool, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command]
pub async fn get_users_debug(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<String>, String> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(users.iter().map(|u| format!("{}|{}|{}|{}", u.username, u.email, u.role, u.is_active)).collect())
}

#[tauri::command]
pub async fn reset_users(
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM users WHERE username = '__check__'")
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn clear_all_sessions(
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM sessions")
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_permission(
    pool: State<'_, SqlitePool>,
    user_id: String,
    required_role: String,
) -> Result<bool, String> {
    crate::services::auth::has_permission(&pool, &user_id, &required_role).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminResetPasswordPayload {
    pub user_id: String,
    pub new_password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordPayload {
    pub user_id: String,
    pub current_password: String,
    pub new_password: String,
}

#[tauri::command]
pub async fn admin_reset_password(
    pool: State<'_, SqlitePool>,
    payload: AdminResetPasswordPayload,
) -> Result<(), String> {
    let password_hash = hash(&payload.new_password, DEFAULT_COST)
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE users SET password_hash = ?1 WHERE id = ?2")
        .bind(&password_hash)
        .bind(&payload.user_id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    // Invalidate all sessions for this user, forcing re-login
    sqlx::query("DELETE FROM sessions WHERE user_id = ?1")
        .bind(&payload.user_id)
        .execute(&*pool)
        .await
        .ok();

    Ok(())
}

#[tauri::command]
pub async fn change_own_password(
    pool: State<'_, SqlitePool>,
    payload: ChangePasswordPayload,
) -> Result<(), String> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = ?1"
    )
    .bind(&payload.user_id)
    .fetch_one(&*pool)
    .await
    .map_err(|_| "User not found".to_string())?;

    let valid = verify(&payload.current_password, &user.password_hash)
        .map_err(|e| e.to_string())?;

    if !valid {
        return Err("Current password is incorrect".to_string());
    }

    let new_hash = hash(&payload.new_password, DEFAULT_COST)
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE users SET password_hash = ?1 WHERE id = ?2")
        .bind(&new_hash)
        .bind(&payload.user_id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRecoveryPayload {
    pub user_id: String,
    pub question: String,
    pub answer: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyRecoveryPayload {
    pub username: String,
    pub answer: String,
    pub new_password: String,
}

#[tauri::command]
pub async fn set_recovery_question(
    pool: State<'_, SqlitePool>,
    payload: SetRecoveryPayload,
) -> Result<(), String> {
    let answer_hash = hash(&payload.answer.to_lowercase().trim(), DEFAULT_COST)
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE users SET recovery_question = ?1, recovery_answer_hash = ?2 WHERE id = ?3"
    )
    .bind(&payload.question)
    .bind(&answer_hash)
    .bind(&payload.user_id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_recovery_question(
    pool: State<'_, SqlitePool>,
    username: String,
) -> Result<Option<String>, String> {
    let question: Option<String> = sqlx::query_scalar(
        "SELECT recovery_question FROM users WHERE username = ?1"
    )
    .bind(&username)
    .fetch_optional(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?
    .flatten();

    Ok(question)
}

#[tauri::command]
pub async fn verify_recovery_answer(
    pool: State<'_, SqlitePool>,
    payload: VerifyRecoveryPayload,
) -> Result<(), String> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?1"
    )
    .bind(&payload.username)
    .fetch_one(&*pool)
    .await
    .map_err(|_| "User not found".to_string())?;

    let stored_hash = user.recovery_answer_hash
        .ok_or("No recovery question set for this account")?;

    let valid = verify(payload.answer.to_lowercase().trim(), &stored_hash)
        .map_err(|e| e.to_string())?;

    if !valid {
        return Err("Incorrect answer".to_string());
    }

    let new_hash = hash(&payload.new_password, DEFAULT_COST)
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE users SET password_hash = ?1 WHERE id = ?2")
        .bind(&new_hash)
        .bind(&user.id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    sqlx::query("DELETE FROM sessions WHERE user_id = ?1")
        .bind(&user.id)
        .execute(&*pool)
        .await
        .ok();

    Ok(())}

// ── FMEA (Failure Mode & Effects Analysis) ─────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFmeaPayload {
    pub equipment_id: String,
    pub failure_mode: String,
    pub effect: Option<String>,
    pub cause: Option<String>,
    pub severity: i64,
    pub occurrence: i64,
    pub detection: i64,
    pub action: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFmeaPayload {
    pub id: String,
    pub failure_mode: Option<String>,
    pub effect: Option<String>,
    pub cause: Option<String>,
    pub severity: Option<i64>,
    pub occurrence: Option<i64>,
    pub detection: Option<i64>,
    pub action: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
}

#[tauri::command]
pub async fn create_fmea(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateFmeaPayload,
) -> Result<FmeaRow, String> {
    enforce(&session, "Engineer")?;
    let id = Uuid::new_v4().to_string();
    let severity = payload.severity.max(1).min(10);
    let occurrence = payload.occurrence.max(1).min(10);
    let detection = payload.detection.max(1).min(10);
    let rpn = severity * occurrence * detection;

    sqlx::query(
        "INSERT INTO fmea (id, equipment_id, failure_mode, effect, cause, severity, occurrence, detection, rpn, action, owner, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    )
    .bind(&id)
    .bind(&payload.equipment_id)
    .bind(&payload.failure_mode)
    .bind(&payload.effect)
    .bind(&payload.cause)
    .bind(severity)
    .bind(occurrence)
    .bind(detection)
    .bind(rpn)
    .bind(&payload.action)
    .bind(&payload.owner)
    .bind(&payload.status.unwrap_or_else(|| "Open".to_string()))
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let row: FmeaRow = sqlx::query_as("SELECT * FROM fmea WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn get_fmea(
    pool: State<'_, SqlitePool>,
    equipment_id: Option<String>,
) -> Result<Vec<FmeaRow>, String> {
    let rows: Vec<FmeaRow> = match equipment_id {
        Some(eid) => sqlx::query_as("SELECT * FROM fmea WHERE equipment_id = ?1 ORDER BY rpn DESC")
            .bind(&eid)
            .fetch_all(&*pool)
            .await,
        None => sqlx::query_as("SELECT * FROM fmea ORDER BY rpn DESC")
            .fetch_all(&*pool)
            .await,
    }
    .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub async fn update_fmea(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpdateFmeaPayload,
) -> Result<FmeaRow, String> {
    enforce(&session, "Engineer")?;
    let existing: FmeaRow = sqlx::query_as("SELECT * FROM fmea WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    let severity = payload.severity.unwrap_or(existing.severity).max(1).min(10);
    let occurrence = payload.occurrence.unwrap_or(existing.occurrence).max(1).min(10);
    let detection = payload.detection.unwrap_or(existing.detection).max(1).min(10);
    let rpn = severity * occurrence * detection;

    sqlx::query(
        "UPDATE fmea SET
            failure_mode = COALESCE(?1, failure_mode),
            effect = COALESCE(?2, effect),
            cause = COALESCE(?3, cause),
            severity = ?4,
            occurrence = ?5,
            detection = ?6,
            rpn = ?7,
            action = COALESCE(?8, action),
            owner = COALESCE(?9, owner),
            status = COALESCE(?10, status)
         WHERE id = ?11"
    )
    .bind(&payload.failure_mode)
    .bind(&payload.effect)
    .bind(&payload.cause)
    .bind(severity)
    .bind(occurrence)
    .bind(detection)
    .bind(rpn)
    .bind(&payload.action)
    .bind(&payload.owner)
    .bind(&payload.status)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let row: FmeaRow = sqlx::query_as("SELECT * FROM fmea WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn delete_fmea(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM fmea WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}
