use std::cmp::Ordering;
use std::collections::HashMap;

use chrono::prelude::*;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::models::{Downtime, Equipment};

#[derive(Serialize)]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
    pub minutes: i64,
}

#[derive(Serialize, Clone)]
pub struct WeibullFit {
    pub beta: f64,
    pub eta: f64,
    pub rul: Option<f64>,
    pub intervals: i64,
}

#[derive(Serialize, Clone)]
pub struct AssetReliability {
    pub equipment_id: String,
    pub tag_number: Option<String>,
    pub name: Option<String>,
    pub mttr: f64,
    pub mtbf: f64,
    pub failure_count: i64,
    pub total_downtime_min: i64,
    pub weibull: Option<WeibullFit>,
}

#[derive(Serialize)]
pub struct ReliabilityReport {
    pub scope: String,
    pub equipment_name: Option<String>,
    pub mttr: f64,
    pub mtbf: f64,
    pub failure_count: i64,
    pub total_downtime_min: i64,
    pub availability_pct: f64,
    pub pareto: Vec<CategoryCount>,
    pub weibull: Option<WeibullFit>,
    pub worst_assets: Vec<AssetReliability>,
}

pub(crate) fn parse_ts(raw: &str) -> Option<NaiveDateTime> {
    let owned = raw.trim().replace('T', " ");
    let base = owned.split('.').next().unwrap_or(&owned);
    let base = base.trim();
    NaiveDateTime::parse_from_str(base, "%Y-%m-%d %H:%M:%S")
        .ok()
        .or_else(|| NaiveDateTime::parse_from_str(base, "%Y-%m-%dT%H:%M:%S").ok())
}

/// Inter-failure intervals (minutes) between consecutive downtime start times.
fn intervals_from(times: &[NaiveDateTime]) -> Vec<f64> {
    let mut out = Vec::new();
    for w in times.windows(2) {
        let mins = (w[1] - w[0]).num_minutes() as f64;
        if mins > 0.0 {
            out.push(mins);
        }
    }
    out
}

fn mean(xs: &[f64]) -> f64 {
    if xs.is_empty() {
        return 0.0;
    }
    xs.iter().sum::<f64>() / xs.len() as f64
}

/// Lanczos approximation of the Gamma function.
fn lanczos_gamma(z: f64) -> f64 {
    let g = 7.0_f64;
    let c: [f64; 9] = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    if z < 0.5 {
        std::f64::consts::PI / (std::f64::consts::PI * (1.0 - z)).sin() * lanczos_gamma(1.0 - z)
    } else {
        let z = z - 1.0;
        let mut x = c[0];
        for i in 1..9 {
            x += c[i] / (z + i as f64);
        }
        let t = z + g + 0.5;
        (2.0 * std::f64::consts::PI).sqrt() * t.powf(z + 0.5) * (-t).exp() * x
    }
}

/// Weibull fit (method of moments) via bisection on the coefficient of variation.
fn weibull_fit(intervals: &[f64], age_min: f64, r_target: f64) -> Option<WeibullFit> {
    let n = intervals.len();
    if n < 2 {
        return None;
    }
    let mu = mean(intervals);
    let var = intervals.iter().map(|x| (x - mu).powi(2)).sum::<f64>() / n as f64;
    let sigma = var.sqrt();
    if mu <= 0.0 || sigma <= 0.0 {
        return None;
    }
    let target_cv = sigma / mu;

    // Weibull CV decreases monotonically with the shape parameter beta.
    let cv_of = |beta: f64| -> f64 {
        let g1 = lanczos_gamma(1.0 + 1.0 / beta);
        let g2 = lanczos_gamma(1.0 + 2.0 / beta);
        (g2 / (g1 * g1) - 1.0).sqrt()
    };

    let mut lo = 0.3_f64;
    let mut hi = 12.0_f64;
    let mut beta = 1.0_f64;
    for _ in 0..80 {
        beta = (lo + hi) / 2.0;
        let cv = cv_of(beta);
        if cv > target_cv {
            lo = beta;
        } else {
            hi = beta;
        }
    }
    let g1 = lanczos_gamma(1.0 + 1.0 / beta);
    let eta = mu / g1;

    let rul = if beta > 0.0 && eta > 0.0 {
        let t_target = eta * (-r_target.ln()).powf(1.0 / beta);
        Some((t_target - age_min).max(0.0))
    } else {
        None
    };

    Some(WeibullFit {
        beta,
        eta,
        rul,
        intervals: n as i64,
    })
}

pub(crate) fn compute_asset(eq: &Equipment, dts: &[Downtime]) -> Option<AssetReliability> {
    if dts.is_empty() {
        return None;
    }
    let mttr = mean(
        &dts
            .iter()
            .map(|d| d.duration_minutes.unwrap_or(0) as f64)
            .collect::<Vec<_>>(),
    );
    let mut times: Vec<NaiveDateTime> = dts
        .iter()
        .filter_map(|d| d.start_time.as_ref().and_then(|s| parse_ts(s)))
        .collect();
    times.sort();
    let intervals = intervals_from(&times);
    let mtbf = mean(&intervals);
    let age = times.last().map(|last| {
        let now = Utc::now().naive_utc();
        (now - *last).num_minutes().max(0) as f64
    });
    let age = age.unwrap_or(0.0);
    let weibull = weibull_fit(&intervals, age, 0.9);
    let total_downtime_min: i64 = dts.iter().map(|d| d.duration_minutes.unwrap_or(0)).sum();
    Some(AssetReliability {
        equipment_id: eq.id.clone(),
        tag_number: eq.tag_number.clone(),
        name: eq.name.clone(),
        mttr,
        mtbf,
        failure_count: dts.len() as i64,
        total_downtime_min,
        weibull,
    })
}

/// Compute per-asset reliability metrics for the whole fleet (assets with at
/// least one downtime event). Shared by the reliability report and the CBM
/// trigger evaluation so the two never drift apart.
pub(crate) async fn compute_fleet_assets(pool: &SqlitePool) -> Result<Vec<AssetReliability>, String> {
    let eqs: Vec<Equipment> = sqlx::query_as("SELECT * FROM equipment")
        .fetch_all(pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    let all_dt: Vec<Downtime> = sqlx::query_as("SELECT * FROM downtime")
        .fetch_all(pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    let mut by_eq: HashMap<String, Vec<Downtime>> = HashMap::new();
    for d in &all_dt {
        by_eq.entry(d.equipment_id.clone()).or_default().push(d.clone());
    }
    for v in by_eq.values_mut() {
        v.sort_by(|a, b| a.start_time.cmp(&b.start_time));
    }

    let mut assets: Vec<AssetReliability> = Vec::new();
    for eq in &eqs {
        if let Some(dts) = by_eq.get(&eq.id) {
            if let Some(a) = compute_asset(eq, dts) {
                assets.push(a);
            }
        }
    }
    Ok(assets)
}

fn collect_categories(dts: &[Downtime]) -> Vec<CategoryCount> {
    let mut cat: HashMap<String, (i64, i64)> = HashMap::new();
    for d in dts {
        if let Some(c) = &d.loss_category {
            if !c.is_empty() {
                let e = cat.entry(c.clone()).or_insert((0, 0));
                e.0 += 1;
                e.1 += d.duration_minutes.unwrap_or(0);
            }
        }
    }
    let mut out: Vec<CategoryCount> = cat
        .into_iter()
        .map(|(category, (count, minutes))| CategoryCount { category, count, minutes })
        .collect();
    out.sort_by(|a, b| b.count.cmp(&a.count));
    out.truncate(5);
    out
}

#[tauri::command]
pub async fn reliability_report(
    pool: State<'_, SqlitePool>,
    equipment_id: Option<String>,
) -> Result<ReliabilityReport, String> {
    let eqs: Vec<Equipment> = sqlx::query_as("SELECT * FROM equipment")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    let all_dt: Vec<Downtime> = sqlx::query_as("SELECT * FROM downtime")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    let mut by_eq: HashMap<String, Vec<Downtime>> = HashMap::new();
    for d in &all_dt {
        by_eq.entry(d.equipment_id.clone()).or_default().push(d.clone());
    }
    for v in by_eq.values_mut() {
        v.sort_by(|a, b| a.start_time.cmp(&b.start_time));
    }

    let mut assets: Vec<AssetReliability> = Vec::new();
    for eq in &eqs {
        if let Some(dts) = by_eq.get(&eq.id) {
            if let Some(a) = compute_asset(eq, dts) {
                assets.push(a);
            }
        }
    }

    if let Some(eid) = equipment_id {
        let eq = eqs.iter().find(|e| e.id == eid);
        let dts = by_eq.get(&eid).cloned().unwrap_or_default();
        let a = eq.and_then(|e| compute_asset(e, &dts));
        let mttr = a.as_ref().map(|x| x.mttr).unwrap_or(0.0);
        let mtbf = a.as_ref().map(|x| x.mtbf).unwrap_or(0.0);
        let failure_count = a.as_ref().map(|x| x.failure_count).unwrap_or(0);
        let total_dt: i64 = dts.iter().map(|d| d.duration_minutes.unwrap_or(0)).sum();
        let avail = if mtbf + mttr > 0.0 {
            (mtbf / (mtbf + mttr)) * 100.0
        } else {
            100.0
        };
        return Ok(ReliabilityReport {
            scope: eid,
            equipment_name: eq.and_then(|e| e.name.clone()),
            mttr,
            mtbf,
            failure_count,
            total_downtime_min: total_dt,
            availability_pct: avail,
            pareto: collect_categories(&dts),
            weibull: a.and_then(|x| x.weibull),
            worst_assets: vec![],
        });
    }

    // Fleet-wide rollup.
    let failure_count: i64 = assets.iter().map(|a| a.failure_count).sum();
    let total_dt: i64 = by_eq
        .values()
        .flat_map(|v| v.iter().map(|d| d.duration_minutes.unwrap_or(0)))
        .sum();
    let all_intervals: Vec<f64> = by_eq
        .values()
        .map(|v| {
            let mut t: Vec<NaiveDateTime> = v
                .iter()
                .filter_map(|d| d.start_time.as_ref().and_then(|s| parse_ts(s)))
                .collect();
            t.sort();
            intervals_from(&t)
        })
        .flatten()
        .collect();
    let mtbf = mean(&all_intervals);
    let all_dur: Vec<f64> = by_eq
        .values()
        .flat_map(|v| v.iter().map(|d| d.duration_minutes.unwrap_or(0) as f64))
        .collect();
    let mttr = mean(&all_dur);
    let pareto = collect_categories(&all_dt);
    let weibull = weibull_fit(&all_intervals, 0.0, 0.9);
    let avail = if mtbf + mttr > 0.0 {
        (mtbf / (mtbf + mttr)) * 100.0
    } else {
        100.0
    };

    let mut worst = assets.clone();
    worst.sort_by(|a, b| {
        a.mtbf
            .partial_cmp(&b.mtbf)
            .unwrap_or(Ordering::Equal)
    });
    worst.truncate(8);

    Ok(ReliabilityReport {
        scope: "fleet".into(),
        equipment_name: None,
        mttr,
        mtbf,
        failure_count,
        total_downtime_min: total_dt,
        availability_pct: avail,
        pareto,
        weibull,
        worst_assets: worst,
    })
}
