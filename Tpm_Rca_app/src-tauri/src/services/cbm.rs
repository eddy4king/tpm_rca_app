use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::models::{ConditionRule, CbmTrigger};
use crate::services::reliability::compute_fleet_assets;
use crate::session::{SessionState, enforce};

fn severity_rank(s: &str) -> u8 {
    match s {
        "High" => 3,
        "Medium" => 2,
        _ => 1,
    }
}

async fn load_rules(pool: &SqlitePool) -> Result<Vec<ConditionRule>, String> {
    let rules = sqlx::query_as::<_, ConditionRule>(
        "SELECT * FROM condition_rules ORDER BY (equipment_id IS NULL) DESC, name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(rules)
}

#[tauri::command]
pub async fn get_cbm_rules(pool: State<'_, SqlitePool>) -> Result<Vec<ConditionRule>, String> {
    load_rules(&pool).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertConditionRulePayload {
    pub id: Option<String>,
    pub equipment_id: Option<String>,
    pub name: String,
    pub min_mtbf_minutes: Option<i64>,
    pub min_rul_minutes: Option<i64>,
    pub max_failure_count: Option<i64>,
    pub max_downtime_minutes: Option<i64>,
    pub max_avg_mttr_minutes: Option<i64>,
}

#[tauri::command]
pub async fn upsert_cbm_rule(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpsertConditionRulePayload,
) -> Result<ConditionRule, String> {
    enforce(&session, "Engineer")?;
    // A fleet-default rule has a NULL equipment_id; an empty string means "default".
    let equipment_id = payload
        .equipment_id
        .filter(|s| !s.trim().is_empty());

    let rule = match payload.id {
        Some(id) if !id.is_empty() => {
            sqlx::query(
                "UPDATE condition_rules SET
                    equipment_id = ?1,
                    name = ?2,
                    min_mtbf_minutes = ?3,
                    min_rul_minutes = ?4,
                    max_failure_count = ?5,
                    max_downtime_minutes = ?6,
                    max_avg_mttr_minutes = ?7
                 WHERE id = ?8",
            )
            .bind(&equipment_id)
            .bind(&payload.name)
            .bind(payload.min_mtbf_minutes)
            .bind(payload.min_rul_minutes)
            .bind(payload.max_failure_count)
            .bind(payload.max_downtime_minutes)
            .bind(payload.max_avg_mttr_minutes)
            .bind(&id)
            .execute(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

            sqlx::query_as::<_, ConditionRule>("SELECT * FROM condition_rules WHERE id = ?1")
                .bind(&id)
                .fetch_one(&*pool)
                .await
                .map_err(|e: sqlx::Error| e.to_string())?
        }
        _ => {
            let id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO condition_rules (id, equipment_id, name, min_mtbf_minutes, min_rul_minutes, max_failure_count, max_downtime_minutes, max_avg_mttr_minutes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )
            .bind(&id)
            .bind(&equipment_id)
            .bind(&payload.name)
            .bind(payload.min_mtbf_minutes)
            .bind(payload.min_rul_minutes)
            .bind(payload.max_failure_count)
            .bind(payload.max_downtime_minutes)
            .bind(payload.max_avg_mttr_minutes)
            .execute(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

            sqlx::query_as::<_, ConditionRule>("SELECT * FROM condition_rules WHERE id = ?1")
                .bind(&id)
                .fetch_one(&*pool)
                .await
                .map_err(|e: sqlx::Error| e.to_string())?
        }
    };

    Ok(rule)
}

#[tauri::command]
pub async fn delete_cbm_rule(pool: State<'_, SqlitePool>, session: State<'_, SessionState>, id: String) -> Result<(), String> {
    enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM condition_rules WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

/// Evaluate every asset against its matching condition rule (equipment-specific
/// rule wins, otherwise the fleet-default rule) and return any breached
/// thresholds as condition-based maintenance triggers, highest severity first.
#[tauri::command]
pub async fn cbm_triggers(pool: State<'_, SqlitePool>) -> Result<Vec<CbmTrigger>, String> {
    compute_cbm_triggers(&pool).await
}

/// Same as the `cbm_triggers` command but accepts a pool reference so other
/// services (e.g. notifications) can evaluate triggers without a `State`.
pub async fn compute_cbm_triggers(pool: &SqlitePool) -> Result<Vec<CbmTrigger>, String> {
    let rules = load_rules(pool).await?;
    let global_rule = rules.iter().find(|r| r.equipment_id.is_none());
    let assets = compute_fleet_assets(pool).await?;

    let mut triggers: Vec<CbmTrigger> = Vec::new();

    for a in assets {
        let rule = rules
            .iter()
            .find(|r| r.equipment_id.as_deref() == Some(&a.equipment_id))
            .or(global_rule);
        let rule = match rule {
            Some(r) => r,
            None => continue,
        };

        let mut reasons: Vec<String> = Vec::new();

        if let Some(min) = rule.min_mtbf_minutes {
            if a.mtbf > 0.0 && a.mtbf < min as f64 {
                reasons.push(format!(
                    "MTBF {:.0} min is below the {:.0} min threshold",
                    a.mtbf, min
                ));
            }
        }

        if let Some(min) = rule.min_rul_minutes {
            if let Some(rul) = a.weibull.as_ref().and_then(|w| w.rul) {
                if rul < min as f64 {
                    reasons.push(format!(
                        "Remaining useful life {:.0} min is below the {:.0} min threshold",
                        rul, min
                    ));
                }
            }
        }

        if let Some(max) = rule.max_failure_count {
            if a.failure_count > max {
                reasons.push(format!(
                    "Failure count {} exceeds the threshold of {}",
                    a.failure_count, max
                ));
            }
        }

        if let Some(max) = rule.max_downtime_minutes {
            if a.total_downtime_min > max {
                reasons.push(format!(
                    "Total downtime {} min exceeds the threshold of {}",
                    a.total_downtime_min, max
                ));
            }
        }

        if let Some(max) = rule.max_avg_mttr_minutes {
            if a.mttr > max as f64 {
                reasons.push(format!(
                    "Average MTTR {:.0} min exceeds the threshold of {:.0}",
                    a.mttr, max
                ));
            }
        }

        if reasons.is_empty() {
            continue;
        }

        let severity = if rule.min_rul_minutes.is_some()
            && a
                .weibull
                .as_ref()
                .and_then(|w| w.rul)
                .map_or(false, |r| r < rule.min_rul_minutes.unwrap_or(0) as f64)
        {
            "High"
        } else {
            "Medium"
        };

        triggers.push(CbmTrigger {
            equipment_id: a.equipment_id,
            tag_number: a.tag_number,
            name: a.name,
            severity: severity.to_string(),
            reasons,
            mtbf: a.mtbf,
            mttr: a.mttr,
            failure_count: a.failure_count,
            rul: a.weibull.and_then(|w| w.rul),
            total_downtime_min: a.total_downtime_min,
        });
    }

    triggers.sort_by(|a, b| severity_rank(&b.severity).cmp(&severity_rank(&a.severity)));
    Ok(triggers)
}
