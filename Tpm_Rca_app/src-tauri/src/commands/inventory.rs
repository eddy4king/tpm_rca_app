use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::{InventoryItem, InventoryTransaction};
use crate::commands::audit::record_audit;
use crate::session::{SessionState, enforce};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemPayload {
    pub part_number: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub qty_on_hand: f64,
    pub reorder_level: f64,
    pub reorder_qty: f64,
    pub unit_cost: Option<f64>,
    pub location: Option<String>,
    pub supplier_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemPayload {
    pub id: String,
    pub part_number: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub qty_on_hand: Option<f64>,
    pub reorder_level: Option<f64>,
    pub reorder_qty: Option<f64>,
    pub unit_cost: Option<f64>,
    pub location: Option<String>,
    pub supplier_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TxnPayload {
    pub item_id: String,
    pub txn_type: String,
    pub qty: f64,
    pub wo_id: Option<String>,
    pub user_id: Option<String>,
    pub note: Option<String>,
}

#[tauri::command]
pub async fn create_item(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateItemPayload,
) -> Result<InventoryItem, String> {
    enforce(&session, "Engineer")?;
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO inventory_items (id, part_number, name, description, category, unit, qty_on_hand, reorder_level, reorder_qty, unit_cost, location, supplier_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    )
    .bind(&id)
    .bind(&payload.part_number)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.category)
    .bind(&payload.unit)
    .bind(payload.qty_on_hand)
    .bind(payload.reorder_level)
    .bind(payload.reorder_qty)
    .bind(payload.unit_cost)
    .bind(&payload.location)
    .bind(&payload.supplier_id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "inventory", Some(&id), "create",
        &format!("Inventory item '{}' ({}) created", payload.name, payload.part_number), None).await.ok();

    sqlx::query_as::<_, InventoryItem>("SELECT * FROM inventory_items WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_items(pool: State<'_, SqlitePool>) -> Result<Vec<InventoryItem>, String> {
    sqlx::query_as::<_, InventoryItem>("SELECT * FROM inventory_items ORDER BY name")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_item(pool: State<'_, SqlitePool>, id: String) -> Result<InventoryItem, String> {
    sqlx::query_as::<_, InventoryItem>("SELECT * FROM inventory_items WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_low_stock_items(pool: State<'_, SqlitePool>) -> Result<Vec<InventoryItem>, String> {
    sqlx::query_as::<_, InventoryItem>(
        "SELECT * FROM inventory_items WHERE qty_on_hand <= reorder_level ORDER BY name"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn update_item(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpdateItemPayload,
) -> Result<InventoryItem, String> {
    enforce(&session, "Engineer")?;
    sqlx::query(
        "UPDATE inventory_items SET
            part_number = COALESCE(?1, part_number),
            name = COALESCE(?2, name),
            description = COALESCE(?3, description),
            category = COALESCE(?4, category),
            unit = COALESCE(?5, unit),
            qty_on_hand = COALESCE(?6, qty_on_hand),
            reorder_level = COALESCE(?7, reorder_level),
            reorder_qty = COALESCE(?8, reorder_qty),
            unit_cost = COALESCE(?9, unit_cost),
            location = COALESCE(?10, location),
            supplier_id = COALESCE(?11, supplier_id),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?12"
    )
    .bind(&payload.part_number)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.category)
    .bind(&payload.unit)
    .bind(payload.qty_on_hand)
    .bind(payload.reorder_level)
    .bind(payload.reorder_qty)
    .bind(payload.unit_cost)
    .bind(&payload.location)
    .bind(&payload.supplier_id)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "inventory", Some(&payload.id), "update",
        "Inventory item updated", None).await.ok();

    sqlx::query_as::<_, InventoryItem>("SELECT * FROM inventory_items WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn delete_item(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM inventory_items WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "inventory", Some(&id), "delete",
        "Inventory item deleted", None).await.ok();
    Ok(())
}

/// Applies a stock movement to an item and records the transaction row.
/// Shared by the `record_inventory_txn` command and by work orders that
/// consume parts. `txn_type`: receive | return => +qty ; issue => -qty ; adjust => set.
pub async fn apply_inventory_change(
    pool: &SqlitePool,
    item_id: &str,
    txn_type: &str,
    qty: f64,
    wo_id: Option<&str>,
    user_id: Option<&str>,
    note: Option<&str>,
) -> Result<(), String> {
    let item = sqlx::query_as::<_, InventoryItem>("SELECT * FROM inventory_items WHERE id = ?1")
        .bind(item_id)
        .fetch_one(pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    let new_qty = match txn_type {
        "receive" | "return" => item.qty_on_hand + qty,
        "issue" => item.qty_on_hand - qty,
        "adjust" => qty,
        other => return Err(format!("Invalid transaction type '{}'", other)),
    };

    sqlx::query(
        "UPDATE inventory_items SET qty_on_hand = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2"
    )
    .bind(new_qty)
    .bind(item_id)
    .execute(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO inventory_transactions (id, item_id, txn_type, qty, wo_id, user_id, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(&id)
    .bind(item_id)
    .bind(txn_type)
    .bind(qty)
    .bind(wo_id)
    .bind(user_id)
    .bind(note)
    .execute(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(())
}

/// Records a stock movement and updates the item's on-hand quantity.
/// txn_type: receive | return => +qty ; issue => -qty ; adjust => set to qty.
#[tauri::command]
pub async fn record_inventory_txn(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: TxnPayload,
) -> Result<InventoryTransaction, String> {
    enforce(&session, "Technician")?;
    apply_inventory_change(
        &pool,
        &payload.item_id,
        &payload.txn_type,
        payload.qty,
        payload.wo_id.as_deref(),
        payload.user_id.as_deref(),
        payload.note.as_deref(),
    ).await?;

    // Return the freshly created transaction row.
    sqlx::query_as::<_, InventoryTransaction>(
        "SELECT * FROM inventory_transactions WHERE item_id = ?1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(&payload.item_id)
    .fetch_one(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_item_transactions(
    pool: State<'_, SqlitePool>,
    item_id: String,
) -> Result<Vec<InventoryTransaction>, String> {
    sqlx::query_as::<_, InventoryTransaction>(
        "SELECT * FROM inventory_transactions WHERE item_id = ?1 ORDER BY created_at DESC"
    )
    .bind(&item_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())
}
