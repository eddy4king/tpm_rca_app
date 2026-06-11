use sqlx::SqlitePool;
use tauri::State;


/// Returns true if the user identified by `user_id` has the `Admin` role.
#[tauri::command]
pub async fn is_admin(pool: State<'_, SqlitePool>, user_id: String) -> Result<bool, String> {
    has_permission(pool, user_id, "Admin").await
}

/// Generic role check used by commands.
#[tauri::command]
pub async fn has_permission(pool: State<'_, SqlitePool>, user_id: String, required_role: &str) -> Result<bool, String> {
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM users WHERE id = ?1"
    )
    .bind(&user_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    let user_role = role.unwrap_or_else(|| "Viewer".to_string());
    // Use the policy module for permission logic
    Ok(crate::policy::permits(&user_role, crate::policy::Role::from(required_role)))
}
