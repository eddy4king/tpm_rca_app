use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::commands::audit::record_audit;
use crate::session::{SessionState, enforce};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportEquipmentRow {
    pub tag_number: String,
    pub name: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub criticality: Option<String>,
    pub status: Option<String>,
    pub equipment_type: Option<String>,
    pub parent_id: Option<String>,
    pub area_id: Option<String>,
    pub cost_per_hour: Option<f64>,
    pub asset_value: Option<f64>,
}

#[tauri::command]
pub async fn import_equipment_csv(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    rows: Vec<ImportEquipmentRow>,
) -> Result<usize, String> {
    enforce(&session, "Engineer")?;
    let mut count: usize = 0;
    for row in rows {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO equipment (id, tag_number, name, description, location, criticality, status, equipment_type, parent_id, area_id, cost_per_hour, asset_value)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
        )
        .bind(&id)
        .bind(&row.tag_number)
        .bind(&row.name)
        .bind(&row.description)
        .bind(&row.location)
        .bind(&row.criticality)
        .bind(&row.status)
        .bind(&row.equipment_type)
        .bind(&row.parent_id)
        .bind(&row.area_id)
        .bind(row.cost_per_hour)
        .bind(row.asset_value)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
        count += 1;
    }

    record_audit(
        &pool,
        "equipment_import",
        None,
        "import_csv",
        &format!("Imported {} equipment from CSV", count),
        None,
    ).await.ok();

    Ok(count)
}