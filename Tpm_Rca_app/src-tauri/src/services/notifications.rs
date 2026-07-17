use sqlx::{SqlitePool, Row};
use uuid::Uuid;

/// Inserts an in-app notification row. External delivery (email/sms/push) is
/// best-effort and gated by `notification_prefs`; the `NOTIFY_WEBHOOK_URL` env
/// (if set) receives a JSON copy for an external delivery pipeline.
pub async fn notify(
    pool: &SqlitePool,
    user_id: Option<&str>,
    ntype: &str,
    title: &str,
    body: &str,
    ref_id: Option<&str>,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO notifications (id, user_id, channel, ntype, title, body, ref_id, read)
         VALUES (?1, ?2, 'in_app', ?3, ?4, ?5, ?6, 0)"
    )
    .bind(&id)
    .bind(user_id)
    .bind(ntype)
    .bind(title)
    .bind(body)
    .bind(ref_id)
    .execute(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    if let Ok(url) = std::env::var("NOTIFY_WEBHOOK_URL") {
        if !url.trim().is_empty() {
            let payload = serde_json::json!({
                "user_id": user_id,
                "type": ntype,
                "title": title,
                "body": body,
                "ref_id": ref_id,
            });
            let _ = reqwest::Client::new()
                .post(&url)
                .json(&payload)
                .send()
                .await;
        }
    }
    Ok(())
}

/// Scans for conditions that should raise alerts (overdue PMs, open/overdue work
/// orders, CbM threshold breaches) and creates one notification per finding,
/// de-duplicating against an existing unread notification for the same ref/type.
pub async fn generate_system_alerts(pool: &SqlitePool) -> Result<usize, String> {
    let mut created = 0;

    // Overdue PM schedules.
    let overdue_pm = sqlx::query(
        "SELECT id, title, equipment_id FROM pm_schedule
         WHERE status <> 'Completed' AND next_due_date IS NOT NULL AND date(next_due_date) < date('now')"
    )
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    for pm in &overdue_pm {
        let id: &str = pm.try_get("id").map_err(|e| e.to_string())?;
        let title: String = pm.try_get("title").unwrap_or_default();
        if !already_notified(pool, "pm_due", id).await? {
            notify(pool, None, "pm_due", "PM overdue", &format!("PM '{}' is past its due date", title), Some(id)).await?;
            created += 1;
        }
    }

    // Open / overdue work orders.
    let open_wo = sqlx::query(
        "SELECT id, wo_number, title, due_date FROM work_orders
         WHERE status NOT IN ('completed','cancelled')
           AND due_date IS NOT NULL AND date(due_date) < date('now')"
    )
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    for wo in &open_wo {
        let id: &str = wo.try_get("id").map_err(|e| e.to_string())?;
        let num: String = wo.try_get("wo_number").unwrap_or_default();
        let title: String = wo.try_get("title").unwrap_or_default();
        if !already_notified(pool, "wo_overdue", id).await? {
            notify(pool, None, "wo_overdue", "Work order overdue",
                &format!("{} '{}' is past its due date", num, title), Some(id)).await?;
            created += 1;
        }
    }

    // CbM threshold breaches.
    match crate::services::cbm::compute_cbm_triggers(pool).await {
        Ok(triggers) => {
            for t in triggers {
                if !already_notified(pool, "threshold_breach", &t.equipment_id).await? {
                    notify(pool, None, "threshold_breach", "Condition threshold breached",
                        &format!("{} ({}) — {}", t.tag_number.unwrap_or_default(), t.name.unwrap_or_default(), t.reasons.join("; ")),
                        Some(&t.equipment_id)).await?;
                    created += 1;
                }
            }
        }
        Err(_) => {}
    }

    Ok(created)
}

async fn already_notified(pool: &SqlitePool, ntype: &str, ref_id: &str) -> Result<bool, String> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE ntype = ?1 AND ref_id = ?2 AND read = 0"
    )
    .bind(ntype)
    .bind(ref_id)
    .fetch_one(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(count > 0)
}
