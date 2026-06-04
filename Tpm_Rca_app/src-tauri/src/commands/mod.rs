use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::{Equipment,
     Downtime,
     RcaInvestigation,
     RcaNode,
     CAPA,
     PmSchedule};



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
#[serde(rename_all = "camelCase")]
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
    .map_err(|e| e.to_string())?;

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
    .map_err(|e| e.to_string())?;

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
    .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?;
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
    .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?;
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
        .map_err(|e| e.to_string())?;
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
    .map_err(|e| e.to_string())?;
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
    .map_err(|e| e.to_string())?;

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
    .map_err(|e| e.to_string())?;

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
    .map_err(|e| e.to_string())?;

    let result: Result<CAPA, sqlx::Error> = sqlx::query_as::<_, CAPA>(
        "SELECT * FROM capa WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let capas = result.map_err(|e: sqlx::Error| e.to_string())?;
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
        .map_err(|e| e.to_string())?;
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
    pub attachments: Option<String>,
}

#[tauri::command]
pub async fn create_pm_schedule(
    pool: State<'_, SqlitePool>,
    payload: CreatePmSchedulePayload,
) -> Result<PmSchedule, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO pm_schedule (id, equipment_id, title, description, frequency, next_due_date, assigned_to, status, attachments)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
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
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

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
            attachments = COALESCE(?8, attachments)
         WHERE id = ?9"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.frequency)
    .bind(&payload.next_due_date)
    .bind(&payload.last_completed_at)
    .bind(&payload.assigned_to)
    .bind(&payload.status)
    .bind(&payload.attachments)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let result: Result<PmSchedule, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule WHERE id = ?1"
    )
    .bind(&payload.id)
    .fetch_one(&*pool)
    .await;

    let schedule = result.map_err(|e: sqlx::Error| e.to_string())?;
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
        .map_err(|e| e.to_string())?;
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
    .map_err(|e| e.to_string())?;

    let result: Result<PmSchedule, sqlx::Error> = sqlx::query_as::<_, PmSchedule>(
        "SELECT * FROM pm_schedule WHERE id = ?1"
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await;

    let schedule = result.map_err(|e: sqlx::Error| e.to_string())?;
    Ok(schedule)
}
