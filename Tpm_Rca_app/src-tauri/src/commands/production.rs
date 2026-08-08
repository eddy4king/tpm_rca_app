use chrono::prelude::*;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::models::{Downtime, ProductionLog};
use crate::services::reliability::parse_ts;
use crate::session::{SessionState, enforce};
use crate::commands::audit::record_audit;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionLogPayload {
    pub equipment_id: String,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
    pub planned_minutes: f64,
    pub total_count: f64,
    pub good_count: f64,
    pub ideal_cycle_minutes: f64,
}

/// Minutes of downtime for one equipment whose start falls inside the period.
async fn downtime_minutes_in_period(
    pool: &SqlitePool,
    equipment_id: &str,
    start: Option<NaiveDateTime>,
    end: Option<NaiveDateTime>,
) -> i64 {
    let rows: Vec<Downtime> = sqlx::query_as(
        "SELECT * FROM downtime WHERE equipment_id = ?1"
    )
    .bind(equipment_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut total: i64 = 0;
    for d in &rows {
        let t = match d.start_time.as_ref().and_then(|s| parse_ts(s)) {
            Some(t) => t,
            None => continue,
        };
        if let Some(s) = start {
            if t < s {
                continue;
            }
        }
        if let Some(e) = end {
            if t > e {
                continue;
            }
        }
        total += d.duration_minutes.unwrap_or(0);
    }
    total
}

/// Aggregate A × P × Q across a set of production logs, summing downtime per
/// equipment/period from the live downtime table.
fn aggregate_oee(
    planned: f64,
    downtime: f64,
    ideal_time: f64,
    total_count: f64,
    good_count: f64,
) -> Value {
    let run_time = (planned - downtime).max(0.0);
    let availability = if planned > 0.0 { run_time / planned } else { 0.0 };
    let mut performance = if run_time > 0.0 { ideal_time / run_time } else { 0.0 };
    if performance > 1.0 {
        performance = 1.0;
    }
    let quality = if total_count > 0.0 {
        (good_count / total_count).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let oee = availability * performance * quality;

    json!({
        "availability": (availability * 100.0).round() as i64,
        "performance": (performance * 100.0).round() as i64,
        "quality": (quality * 100.0).round() as i64,
        "oee": (oee * 100.0).round() as i64,
        "planned_minutes": planned,
        "downtime_minutes": downtime,
        "run_time_minutes": run_time,
        "total_count": total_count,
        "good_count": good_count
    })
}

#[tauri::command]
pub async fn create_production_log(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateProductionLogPayload,
) -> Result<ProductionLog, String> {
    enforce(&session, "Technician")?;
    if payload.equipment_id.trim().is_empty() {
        return Err("equipment_id is required".into());
    }
    let id = Uuid::new_v4().to_string();
    let good = if payload.good_count > payload.total_count {
        payload.total_count
    } else {
        payload.good_count
    };

    sqlx::query(
        "INSERT INTO production_log
         (id, equipment_id, period_start, period_end, planned_minutes, total_count, good_count, ideal_cycle_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
    .bind(&id)
    .bind(&payload.equipment_id)
    .bind(&payload.period_start)
    .bind(&payload.period_end)
    .bind(payload.planned_minutes)
    .bind(payload.total_count)
    .bind(good)
    .bind(payload.ideal_cycle_minutes)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(
        &pool,
        "production_log",
        Some(&id),
        "create",
        &format!("Production log for equipment {} recorded", payload.equipment_id),
        None,
    )
    .await
    .ok();

    let log = sqlx::query_as::<_, ProductionLog>("SELECT * FROM production_log WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(log)
}

#[tauri::command]
pub async fn list_production_logs(
    pool: State<'_, SqlitePool>,
    equipment_id: Option<String>,
) -> Result<Vec<ProductionLog>, String> {
    let logs = match equipment_id {
        Some(eid) => sqlx::query_as::<_, ProductionLog>(
            "SELECT * FROM production_log WHERE equipment_id = ?1 ORDER BY period_start DESC"
        )
        .bind(&eid)
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?,
        None => sqlx::query_as::<_, ProductionLog>(
            "SELECT * FROM production_log ORDER BY period_start DESC"
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?,
    };
    Ok(logs)
}

#[tauri::command]
pub async fn delete_production_log(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM production_log WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    record_audit(
        &pool,
        "production_log",
        Some(&id),
        "delete",
        "Production log deleted",
        None,
    )
    .await
    .ok();
    Ok(())
}

/// Per-equipment OEE breakdown (Availability × Performance × Quality).
#[tauri::command]
pub async fn get_equipment_oee(
    pool: State<'_, SqlitePool>,
    equipment_id: String,
) -> Result<Value, String> {
    let logs: Vec<ProductionLog> = sqlx::query_as(
        "SELECT * FROM production_log WHERE equipment_id = ?1 ORDER BY period_start"
    )
    .bind(&equipment_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    if logs.is_empty() {
        return Ok(json!({
            "equipment_id": equipment_id,
            "has_data": false,
            "availability": 0,
            "performance": 0,
            "quality": 0,
            "oee": 0
        }));
    }

    let mut planned = 0.0;
    let mut downtime = 0.0;
    let mut ideal_time = 0.0;
    let mut total_count = 0.0;
    let mut good_count = 0.0;

    for log in &logs {
        let dt = downtime_minutes_in_period(
            &pool,
            &equipment_id,
            log.period_start.as_ref().and_then(|s| parse_ts(s)),
            log.period_end.as_ref().and_then(|s| parse_ts(s)),
        )
        .await as f64;
        planned += log.planned_minutes;
        downtime += dt;
        ideal_time += log.total_count * log.ideal_cycle_minutes;
        total_count += log.total_count;
        good_count += log.good_count;
    }

    let mut result = aggregate_oee(planned, downtime, ideal_time, total_count, good_count);
    result["equipment_id"] = json!(equipment_id);
    result["has_data"] = json!(true);
    Ok(result)
}

/// Fleet-wide OEE. Falls back to the Availability-only estimate (performance and
/// quality assumed at 100%) until production logs are captured.
#[tauri::command]
pub async fn get_oee_metrics(pool: State<'_, SqlitePool>) -> Result<Value, String> {
    let logs: Vec<ProductionLog> = sqlx::query_as("SELECT * FROM production_log")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    if logs.is_empty() {
        // Backwards-compatible estimate: 30-day planned window, P & Q = 100%.
        let planned_minutes: i64 = 30 * 24 * 60;
        let total_downtime: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(duration_minutes), 0) FROM downtime"
        )
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
        let availability =
            ((planned_minutes - total_downtime).max(0) as f64 / planned_minutes as f64) * 100.0;
        return Ok(json!({
            "has_production_data": false,
            "availability": availability.round() as i64,
            "performance": 100,
            "quality": 100,
            "oee": availability.round() as i64,
        }));
    }

    let mut planned = 0.0;
    let mut downtime = 0.0;
    let mut ideal_time = 0.0;
    let mut total_count = 0.0;
    let mut good_count = 0.0;

    for log in &logs {
        let dt = downtime_minutes_in_period(
            &pool,
            &log.equipment_id,
            log.period_start.as_ref().and_then(|s| parse_ts(s)),
            log.period_end.as_ref().and_then(|s| parse_ts(s)),
        )
        .await as f64;
        planned += log.planned_minutes;
        downtime += dt;
        ideal_time += log.total_count * log.ideal_cycle_minutes;
        total_count += log.total_count;
        good_count += log.good_count;
    }

    let mut result = aggregate_oee(planned, downtime, ideal_time, total_count, good_count);
    result["has_production_data"] = json!(true);
    Ok(result)
}
