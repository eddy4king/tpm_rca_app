
use serde::Serialize;

#[derive(Serialize)]
pub struct RoleInfo {
    pub name: String,
    pub description: String,
    pub permissions: Vec<String>,
}

/// Nav/page keys used by the frontend for navigation gating.
/// These MUST stay in sync with the `Page` union in `src/App.tsx`.
fn all_pages() -> Vec<String> {
    vec![
        "dashboard", "equipment", "hierarchy", "downtime", "rca", "capa",
        "pm", "tasks", "timeline", "audit", "fmea", "cbm", "sync", "knowledge", "financials",
        "inventory", "workorders", "timesheets", "schedule", "reports",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

#[tauri::command]
pub async fn get_role_permissions() -> Result<Vec<RoleInfo>, String> {
    // Define static role permissions matching the UI and backend policy.
    // Permissions are page/nav keys that control which modules are visible.
    // Write access within a visible module is gated separately via `canEdit`
    // (role rank) in the frontend AuthContext.
    let roles = vec![
        RoleInfo {
            name: "Admin".into(),
            description: "Full access — manage users, all modules, sync settings".into(),
            permissions: vec!["*".into()], // wildcard – everything allowed
        },
        RoleInfo {
            name: "Engineer".into(),
            description: "All modules — read/write on RCA, CAPA, PM, Downtime".into(),
            permissions: all_pages(),
        },
        RoleInfo {
            name: "Technician".into(),
            description: "Downtime Logger & PM Scheduler read/write; core modules read-only".into(),
            permissions: vec![
                "dashboard", "equipment", "hierarchy", "downtime", "pm", "tasks", "timeline",
            ]
            .into_iter()
            .map(|s| s.to_string())
            .collect(),
        },
        RoleInfo {
            name: "Viewer".into(),
            description: "Read-only access to all modules".into(),
            permissions: all_pages(),
        },
    ];
    Ok(roles)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn returns_four_roles() {
        let roles = get_role_permissions().await.unwrap();
        assert_eq!(roles.len(), 4);
    }

    #[tokio::test]
    async fn admin_has_wildcard() {
        let roles = get_role_permissions().await.unwrap();
        let admin = roles.iter().find(|r| r.name == "Admin").unwrap();
        assert_eq!(admin.permissions, vec!["*".to_string()]);
    }

    #[tokio::test]
    async fn viewer_sees_all_pages_but_not_wildcard() {
        let roles = get_role_permissions().await.unwrap();
        let viewer = roles.iter().find(|r| r.name == "Viewer").unwrap();
        assert!(viewer.permissions.contains(&"dashboard".to_string()));
        assert!(viewer.permissions.contains(&"sync".to_string()));
        assert!(!viewer.permissions.contains(&"*".to_string()));
    }

    #[tokio::test]
    async fn technician_cannot_see_rca() {
        let roles = get_role_permissions().await.unwrap();
        let tech = roles.iter().find(|r| r.name == "Technician").unwrap();
        assert!(tech.permissions.contains(&"downtime".to_string()));
        assert!(!tech.permissions.contains(&"rca".to_string()));
    }
}
