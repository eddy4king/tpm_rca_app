use serde::Deserialize;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::{WorkOrder, WoLabor, WoPart, InventoryItem};
use crate::commands::audit::record_audit;
use crate::commands::inventory::apply_inventory_change;
use crate::session::{SessionState, enforce};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWoPayload {
    pub title: String,
    pub description: Option<String>,
    pub equipment_id: Option<String>,
    pub wo_type: String,
    pub source_id: Option<String>,
    pub priority: Option<String>,
    pub assigned_to: Option<String>,
    pub planned_start: Option<String>,
    pub due_date: Option<String>,
    pub approval_status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWoPayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub equipment_id: Option<String>,
    pub wo_type: Option<String>,
    pub source_id: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assigned_to: Option<String>,
    pub planned_start: Option<String>,
    pub due_date: Option<String>,
    pub approval_status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WoLaborPayload {
    pub wo_id: String,
    pub person_name: Option<String>,
    pub minutes: f64,
    pub rate: Option<f64>,
    pub note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WoPartPayload {
    pub wo_id: String,
    pub item_id: Option<String>,
    pub qty: f64,
    pub unit_cost: Option<f64>,
}

fn gen_wo_number() -> String {
    let ts = chrono::Utc::now().format("%Y%m%d");
    let suffix = &Uuid::new_v4().to_string()[..4];
    format!("WO-{}-{}", ts, suffix.to_uppercase())
}

#[tauri::command]
pub async fn create_wo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateWoPayload,
) -> Result<WorkOrder, String> {
    enforce(&session, "Technician")?;
    let id = Uuid::new_v4().to_string();
    let wo_number = gen_wo_number();
    sqlx::query(
        "INSERT INTO work_orders (id, wo_number, title, description, equipment_id, wo_type, source_id, status, priority, assigned_to, planned_start, due_date, approval_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8, ?9, ?10, ?11, ?12)"
    )
    .bind(&id)
    .bind(&wo_number)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.equipment_id)
    .bind(&payload.wo_type)
    .bind(&payload.source_id)
    .bind(&payload.priority.unwrap_or_else(|| "medium".into()))
    .bind(&payload.assigned_to)
    .bind(&payload.planned_start)
    .bind(&payload.due_date)
    .bind(&payload.approval_status.unwrap_or_else(|| "none".into()))
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "work_order", Some(&id), "create",
        &format!("Work order {} '{}' created", wo_number, payload.title), None).await.ok();

    sqlx::query_as::<_, WorkOrder>("SELECT * FROM work_orders WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_wos(pool: State<'_, SqlitePool>) -> Result<Vec<WorkOrder>, String> {
    sqlx::query_as::<_, WorkOrder>("SELECT * FROM work_orders ORDER BY created_at DESC")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_wo(pool: State<'_, SqlitePool>, id: String) -> Result<WorkOrder, String> {
    sqlx::query_as::<_, WorkOrder>("SELECT * FROM work_orders WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn update_wo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpdateWoPayload,
) -> Result<WorkOrder, String> {
    enforce(&session, "Technician")?;
    sqlx::query(
        "UPDATE work_orders SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            equipment_id = COALESCE(?3, equipment_id),
            wo_type = COALESCE(?4, wo_type),
            source_id = COALESCE(?5, source_id),
            status = COALESCE(?6, status),
            priority = COALESCE(?7, priority),
            assigned_to = COALESCE(?8, assigned_to),
            planned_start = COALESCE(?9, planned_start),
            due_date = COALESCE(?10, due_date),
            approval_status = COALESCE(?11, approval_status),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?12"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.equipment_id)
    .bind(&payload.wo_type)
    .bind(&payload.source_id)
    .bind(&payload.status)
    .bind(&payload.priority)
    .bind(&payload.assigned_to)
    .bind(&payload.planned_start)
    .bind(&payload.due_date)
    .bind(&payload.approval_status)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "work_order", Some(&payload.id), "update",
        "Work order updated", None).await.ok();

    sqlx::query_as::<_, WorkOrder>("SELECT * FROM work_orders WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn complete_wo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<WorkOrder, String> {
    enforce(&session, "Technician")?;
    sqlx::query(
        "UPDATE work_orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
    )
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "work_order", Some(&id), "complete",
        "Work order completed", None).await.ok();

    sqlx::query_as::<_, WorkOrder>("SELECT * FROM work_orders WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn delete_wo(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Technician")?;
    sqlx::query("DELETE FROM work_orders WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "work_order", Some(&id), "delete",
        "Work order deleted", None).await.ok();
    Ok(())
}

#[tauri::command]
pub async fn add_wo_labor(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: WoLaborPayload,
) -> Result<WoLabor, String> {
    enforce(&session, "Technician")?;
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO wo_labor (id, wo_id, person_name, minutes, rate, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(&id)
    .bind(&payload.wo_id)
    .bind(&payload.person_name)
    .bind(payload.minutes)
    .bind(payload.rate)
    .bind(&payload.note)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    sqlx::query_as::<_, WoLabor>("SELECT * FROM wo_labor WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn remove_wo_labor(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Technician")?;
    sqlx::query("DELETE FROM wo_labor WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn add_wo_part(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: WoPartPayload,
) -> Result<WoPart, String> {
    enforce(&session, "Technician")?;
    let id = Uuid::new_v4().to_string();

    // Resolve part number + cost from inventory when an item is linked.
    let (part_number, unit_cost) = if let Some(item_id) = &payload.item_id {
        let item = sqlx::query_as::<_, InventoryItem>("SELECT * FROM inventory_items WHERE id = ?1")
            .bind(item_id)
            .fetch_one(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;
        // Consume stock.
        apply_inventory_change(&pool, item_id, "issue", payload.qty, Some(&payload.wo_id), None, Some("Work order issue")).await?;
        (Some(item.part_number.clone()), payload.unit_cost.or(item.unit_cost))
    } else {
        (None, payload.unit_cost)
    };

    sqlx::query(
        "INSERT INTO wo_parts (id, wo_id, item_id, part_number, qty, unit_cost) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(&id)
    .bind(&payload.wo_id)
    .bind(&payload.item_id)
    .bind(&part_number)
    .bind(payload.qty)
    .bind(unit_cost)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    sqlx::query_as::<_, WoPart>("SELECT * FROM wo_parts WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn remove_wo_part(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Technician")?;
    sqlx::query("DELETE FROM wo_parts WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_wo_labor(pool: State<'_, SqlitePool>, wo_id: String) -> Result<Vec<WoLabor>, String> {
    sqlx::query_as::<_, WoLabor>("SELECT * FROM wo_labor WHERE wo_id = ?1 ORDER BY created_at")
        .bind(&wo_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_wo_parts(pool: State<'_, SqlitePool>, wo_id: String) -> Result<Vec<WoPart>, String> {
    sqlx::query_as::<_, WoPart>("SELECT * FROM wo_parts WHERE wo_id = ?1 ORDER BY created_at")
        .bind(&wo_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

/// Returns all labor entries joined with their work order, for timesheet
/// reporting. Optionally filtered by person name and a date range (inclusive).
#[tauri::command]
pub async fn get_timesheet_entries(
    pool: State<'_, SqlitePool>,
    person: Option<String>,
    from: Option<String>,
    to: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let mut sql = String::from(
        "SELECT l.id, l.person_name, l.minutes, l.rate, l.note, l.created_at,
                w.wo_number, w.title AS wo_title, w.equipment_id, w.status AS wo_status
         FROM wo_labor l
         JOIN work_orders w ON w.id = l.wo_id
         WHERE 1=1"
    );
    if person.is_some() { sql.push_str(" AND l.person_name LIKE ?"); }
    if from.is_some() { sql.push_str(" AND date(l.created_at) >= date(?)"); }
    if to.is_some() { sql.push_str(" AND date(l.created_at) <= date(?)"); }
    sql.push_str(" ORDER BY l.created_at DESC");

    let mut q = sqlx::query(&sql);
    if let Some(v) = &person { q = q.bind(format!("%{}%", v)); }
    if let Some(v) = &from { q = q.bind(v); }
    if let Some(v) = &to { q = q.bind(v); }

    let rows = q.fetch_all(&*pool).await.map_err(|e: sqlx::Error| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        let minutes: f64 = r.try_get("minutes").unwrap_or(0.0);
        let rate: Option<f64> = r.try_get("rate").ok().flatten();
        let cost = minutes / 60.0 * rate.unwrap_or(0.0);
        out.push(serde_json::json!({
            "id": r.try_get::<String, _>("id").unwrap_or_default(),
            "person_name": r.try_get::<Option<String>, _>("person_name").ok().flatten(),
            "minutes": minutes,
            "rate": rate,
            "cost": cost,
            "note": r.try_get::<Option<String>, _>("note").ok().flatten(),
            "created_at": r.try_get::<Option<String>, _>("created_at").ok().flatten(),
            "wo_number": r.try_get::<String, _>("wo_number").unwrap_or_default(),
            "wo_title": r.try_get::<Option<String>, _>("wo_title").ok().flatten(),
            "wo_status": r.try_get::<Option<String>, _>("wo_status").ok().flatten(),
        }));
    }
    Ok(out)
}
