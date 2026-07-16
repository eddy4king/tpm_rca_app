use sqlx::SqlitePool;

#[allow(dead_code)]
pub async fn is_admin(pool: &SqlitePool, user_id: &str) -> Result<bool, String> {
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM users WHERE id = ?1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(role.unwrap_or_default() == "Admin")
}

#[allow(dead_code)]
pub async fn has_permission(pool: &SqlitePool, user_id: &str, required_role: &str) -> Result<bool, String> {
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM users WHERE id = ?1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let user_role = role.unwrap_or_else(|| "Viewer".to_string());
    Ok(crate::policy::permits(&user_role, required_role))
}