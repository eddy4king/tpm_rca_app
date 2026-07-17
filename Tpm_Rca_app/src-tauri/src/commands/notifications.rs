use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use crate::models::{Notification, NotificationPref};
use crate::services::notifications::generate_system_alerts;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePrefsPayload {
    pub user_id: String,
    pub in_app: Option<i64>,
    pub email: Option<i64>,
    pub sms: Option<i64>,
    pub push: Option<i64>,
    pub pm_due: Option<i64>,
    pub threshold_breach: Option<i64>,
    pub wo_overdue: Option<i64>,
}

#[tauri::command]
pub async fn get_notifications(pool: State<'_, SqlitePool>) -> Result<Vec<Notification>, String> {
    sqlx::query_as::<_, Notification>("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200")
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

#[tauri::command]
pub async fn get_unread_count(pool: State<'_, SqlitePool>) -> Result<i64, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE read = 0")
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub async fn mark_notification_read(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("UPDATE notifications SET read = 1 WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn mark_all_read(pool: State<'_, SqlitePool>) -> Result<(), String> {
    sqlx::query("UPDATE notifications SET read = 1 WHERE read = 0")
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_notification_prefs(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<NotificationPref, String> {
    if let Ok(p) = sqlx::query_as::<_, NotificationPref>("SELECT * FROM notification_prefs WHERE user_id = ?1")
        .bind(&user_id)
        .fetch_one(&*pool)
        .await
    {
        return Ok(p);
    }
    // Default preferences when none exist yet.
    Ok(NotificationPref {
        user_id, in_app: 1, email: 0, sms: 0, push: 0,
        pm_due: 1, threshold_breach: 1, wo_overdue: 1,
    })
}

#[tauri::command]
pub async fn update_notification_prefs(
    pool: State<'_, SqlitePool>,
    payload: UpdatePrefsPayload,
) -> Result<NotificationPref, String> {
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM notification_prefs WHERE user_id = ?1")
        .bind(&payload.user_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    if existing > 0 {
        sqlx::query(
            "UPDATE notification_prefs SET
                in_app = COALESCE(?1, in_app),
                email = COALESCE(?2, email),
                sms = COALESCE(?3, sms),
                push = COALESCE(?4, push),
                pm_due = COALESCE(?5, pm_due),
                threshold_breach = COALESCE(?6, threshold_breach),
                wo_overdue = COALESCE(?7, wo_overdue)
             WHERE user_id = ?8"
        )
        .bind(payload.in_app).bind(payload.email).bind(payload.sms).bind(payload.push)
        .bind(payload.pm_due).bind(payload.threshold_breach).bind(payload.wo_overdue)
        .bind(&payload.user_id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    } else {
        sqlx::query(
            "INSERT INTO notification_prefs (user_id, in_app, email, sms, push, pm_due, threshold_breach, wo_overdue)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&payload.user_id)
        .bind(payload.in_app.unwrap_or(1)).bind(payload.email.unwrap_or(0))
        .bind(payload.sms.unwrap_or(0)).bind(payload.push.unwrap_or(0))
        .bind(payload.pm_due.unwrap_or(1)).bind(payload.threshold_breach.unwrap_or(1))
        .bind(payload.wo_overdue.unwrap_or(1))
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    }

    sqlx::query_as::<_, NotificationPref>("SELECT * FROM notification_prefs WHERE user_id = ?1")
        .bind(&payload.user_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

/// Evaluates overdue PMs, overdue work orders and CbM breaches, creating alerts.
/// Returns the number of new notifications created.
#[tauri::command]
pub async fn generate_alerts(pool: State<'_, SqlitePool>) -> Result<usize, String> {
    generate_system_alerts(&pool).await
}
