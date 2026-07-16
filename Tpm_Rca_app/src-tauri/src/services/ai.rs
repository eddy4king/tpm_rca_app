use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;

use crate::models::{Downtime, Equipment, RcaInvestigation};

#[derive(Serialize)]
pub struct CoachCategory {
    pub category: String,
    pub count: i64,
    pub minutes: i64,
}

#[derive(Serialize)]
pub struct CoachRecurring {
    pub signature: String,
    pub count: i64,
    pub example: String,
}

#[derive(Serialize)]
pub struct CoachAction {
    pub title: String,
    pub description: String,
}

#[derive(Serialize)]
pub struct CoachSeed {
    pub problem: String,
    pub causes: Vec<String>,
    pub actions: Vec<String>,
}

#[derive(Serialize)]
pub struct CoachStats {
    pub downtime_count: i64,
    pub total_minutes: i64,
    pub avg_mttr: i64,
    pub recurring_count: i64,
    pub open_investigations: i64,
}

#[derive(Serialize)]
pub struct RcaCoachReport {
    pub equipment_id: String,
    pub equipment_name: Option<String>,
    pub stats: CoachStats,
    pub top_loss_categories: Vec<CoachCategory>,
    pub recurring_failures: Vec<CoachRecurring>,
    pub suggested_failure_modes: Vec<String>,
    pub suggested_capa: Vec<CoachAction>,
    pub rca_seed: CoachSeed,
    pub has_history: bool,
}

fn normalize_title(raw: &str) -> String {
    raw.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
}

struct Knowledge {
    failure_modes: Vec<String>,
    capa: Vec<CoachAction>,
    causes: Vec<String>,
    actions: Vec<String>,
}

fn coach_knowledge(cats: &[String], eq_type: &str) -> Knowledge {
    let mut k = Knowledge {
        failure_modes: Vec::new(),
        capa: Vec::new(),
        causes: Vec::new(),
        actions: Vec::new(),
    };

    // Generic human-factor guidance (always relevant).
    k.failure_modes.push("Human / operator error".into());
    k.capa.push(CoachAction {
        title: "Refresh operator training & standardize work instruction".into(),
        description: "Create a clear SOP and confirm competency; add a pre-start checklist.".into(),
    });

    for c in cats {
        match c.as_str() {
            "Mechanical" => {
                k.failure_modes.push("Bearing / seal / gasket wear".into());
                k.causes.push("Mechanical component worn (bearing, seal, coupling)".into());
                k.capa.push(CoachAction {
                    title: "Implement lubrication PM & vibration check".into(),
                    description: "Add scheduled lubrication and periodic vibration analysis to the PM plan.".into(),
                });
                k.actions.push("Schedule preventive lubrication & inspect for wear".into());
            }
            "Electrical" => {
                k.failure_modes.push("Electrical fault (motor, contactor, wiring)".into());
                k.causes.push("Electrical fault (motor, drive, wiring, sensor)".into());
                k.capa.push(CoachAction {
                    title: "Thermal & connection inspection PM".into(),
                    description: "Add infrared/thermal inspection and torque-check of terminals to the PM plan.".into(),
                });
                k.actions.push("Inspect electrical connections & test protection".into());
            }
            "Process" => {
                k.failure_modes.push("Process upset (pressure, flow, temperature)".into());
                k.causes.push("Process parameter drift / upset".into());
                k.capa.push(CoachAction {
                    title: "Tighten process control limits & alarms".into(),
                    description: "Review setpoints, add interlocks/alarms for out-of-range conditions.".into(),
                });
                k.actions.push("Review process setpoints & add alarm limits".into());
            }
            "Quality" => {
                k.failure_modes.push("Quality / product defect".into());
                k.causes.push("Quality defect from process or material".into());
                k.capa.push(CoachAction {
                    title: "Contain, sort & correct root cause".into(),
                    description: "Quarantine affected output, identify defect source, correct upstream control.".into(),
                });
                k.actions.push("Quarantine & trace defect source".into());
            }
            "Changeover" => {
                k.failure_modes.push("Changeover / setup error".into());
                k.causes.push("Changeover / setup not standardized".into());
                k.capa.push(CoachAction {
                    title: "SMED & validated setup checklist".into(),
                    description: "Standardize changeover with a validated checklist and quick-change tools.".into(),
                });
                k.actions.push("Create validated changeover checklist".into());
            }
            "Material" => {
                k.failure_modes.push("Material / component defect".into());
                k.causes.push("Incoming material / part defect".into());
                k.capa.push(CoachAction {
                    title: "Supplier quality & incoming inspection".into(),
                    description: "Raise supplier NCR, add incoming inspection for the affected part.".into(),
                });
                k.actions.push("Raise supplier NCR & add incoming check".into());
            }
            "Tooling" => {
                k.failure_modes.push("Tooling / fixture wear or failure".into());
                k.causes.push("Tooling worn or incorrectly set".into());
                k.capa.push(CoachAction {
                    title: "Tooling PM & setup verification".into(),
                    description: "Add tool-life tracking and pre-run setup verification.".into(),
                });
                k.actions.push("Add tool-life tracking & verify setup".into());
            }
            "Software/Control" => {
                k.failure_modes.push("Control / software fault".into());
                k.causes.push("PLC / control logic or software fault".into());
                k.capa.push(CoachAction {
                    title: "Control logic review & version control".into(),
                    description: "Review logic, add change control and backup of the controller program.".into(),
                });
                k.actions.push("Review control logic & back up program".into());
            }
            _ => {}
        }
    }

    // Equipment-type specific failure modes.
    let et = eq_type.to_lowercase();
    if et.contains("pump") {
        k.failure_modes.push("Cavitation / suction / seal failure (pump)".into());
        k.causes.push("Pump: cavitation, blockage or seal failure".into());
        k.actions.push("Check suction, NPSH & seal condition".into());
    } else if et.contains("motor") {
        k.failure_modes.push("Overheating / insulation breakdown (motor)".into());
        k.causes.push("Motor: overheating or insulation breakdown".into());
        k.actions.push("Check load, cooling & insulation resistance".into());
    } else if et.contains("conveyor") || et.contains("belt") {
        k.failure_modes.push("Belt / roller misalignment or wear".into());
        k.causes.push("Conveyor: belt mistracking or roller wear".into());
        k.actions.push("Align & tension belt; inspect rollers".into());
    }

    k
}

#[tauri::command]
pub async fn rca_coach_report(
    pool: State<'_, SqlitePool>,
    equipment_id: String,
) -> Result<RcaCoachReport, String> {
    let eq: Option<Equipment> = sqlx::query_as::<_, Equipment>("SELECT * FROM equipment WHERE id = ?1")
        .bind(&equipment_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    let downtimes: Vec<Downtime> =
        sqlx::query_as::<_, Downtime>("SELECT * FROM downtime WHERE equipment_id = ?1 ORDER BY created_at DESC")
            .bind(&equipment_id)
            .fetch_all(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

    let investigations: Vec<RcaInvestigation> =
        sqlx::query_as::<_, RcaInvestigation>("SELECT * FROM rca_investigations WHERE equipment_id = ?1")
            .bind(&equipment_id)
            .fetch_all(&*pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

    let mut cat_map: HashMap<String, (i64, i64)> = HashMap::new();
    let mut rec_map: HashMap<String, (i64, String)> = HashMap::new();
    let mut total_minutes: i64 = 0;

    for d in &downtimes {
        let mins = d.duration_minutes.unwrap_or(0);
        total_minutes += mins;
        if let Some(cat) = &d.loss_category {
            if !cat.is_empty() {
                let e = cat_map.entry(cat.clone()).or_insert((0, 0));
                e.0 += 1;
                e.1 += mins;
            }
        }
        if let Some(title) = &d.title {
            let sig = normalize_title(title);
            if !sig.is_empty() {
                let e = rec_map.entry(sig).or_insert((0, title.clone()));
                e.0 += 1;
            }
        }
    }

    let mut top_loss_categories: Vec<CoachCategory> = cat_map
        .into_iter()
        .map(|(category, (count, minutes))| CoachCategory { category, count, minutes })
        .collect();
    top_loss_categories.sort_by(|a, b| b.count.cmp(&a.count));
    top_loss_categories.truncate(5);

    let mut recurring_failures: Vec<CoachRecurring> = Vec::new();
    let mut recurring_count = 0;
    for (sig, (count, example)) in rec_map {
        if count >= 2 {
            recurring_count += 1;
            recurring_failures.push(CoachRecurring {
                signature: sig,
                count,
                example,
            });
        }
    }
    recurring_failures.sort_by(|a, b| b.count.cmp(&a.count));

    let downtime_count = downtimes.len() as i64;
    let avg_mttr = if downtime_count > 0 {
        total_minutes / downtime_count
    } else {
        0
    };
    let open_investigations = investigations
        .iter()
        .filter(|i| {
            let s = i.status.clone().unwrap_or_default();
            s != "Closed" && s != "Resolved"
        })
        .count() as i64;

    let cats: Vec<String> = top_loss_categories
        .iter()
        .map(|c| c.category.clone())
        .collect();
    let eq_type = eq.as_ref()
        .and_then(|e| e.equipment_type.clone())
        .unwrap_or_default();
    let knowledge = coach_knowledge(&cats, &eq_type);

    let name = eq.as_ref().and_then(|e| e.name.clone().or_else(|| e.tag_number.clone()));
    let problem = format!(
        "{} — recurring failure / downtime",
        name.clone().unwrap_or_else(|| "Asset".to_string())
    );

    let has_history = downtime_count > 0 || !investigations.is_empty();

    Ok(RcaCoachReport {
        equipment_id,
        equipment_name: name,
        stats: CoachStats {
            downtime_count,
            total_minutes,
            avg_mttr,
            recurring_count,
            open_investigations,
        },
        top_loss_categories,
        recurring_failures,
        suggested_failure_modes: knowledge.failure_modes,
        suggested_capa: knowledge.capa,
        rca_seed: CoachSeed {
            problem,
            causes: knowledge.causes,
            actions: knowledge.actions,
        },
        has_history,
    })
}
