
use serde::Serialize;

#[derive(Serialize)]
pub struct RoleInfo {
    pub name: String,
    pub description: String,
    pub permissions: Vec<String>,
}

/// Nav/page keys used by the frontend for navigation gating.
/// These MUST stay in sync with the `Page` union in `src/App.tsx`.
fn engineer_pages() -> Vec<String> {
    vec![
        "dashboard", "equipment", "hierarchy", "downtime", "pm", "tasks", "timeline",
        "rca", "capa", "fmea", "cbm", "workorders", "timesheets", "inventory",
        "knowledge", "financials", "reports", "schedule", "kaizen", "audit",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

/// Read-only overview pages suitable for stakeholders / viewers.
fn viewer_pages() -> Vec<String> {
    vec![
        "dashboard", "equipment", "hierarchy", "timeline",
        "financials", "reports", "kaizen", "audit",
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
            permissions: engineer_pages(),
        },
        RoleInfo {
            name: "Technician".into(),
            description: "Downtime Logger & PM Scheduler read/write; core modules read-only".into(),
        permissions: vec![
            "dashboard", "equipment", "hierarchy", "downtime", "pm", "tasks", "timeline",
            "kaizen",
        ]
            .into_iter()
            .map(|s| s.to_string())
            .collect(),
        },
        RoleInfo {
            name: "Viewer".into(),
            description: "Read-only overview: dashboard, financials, reports, leaderboard".into(),
            permissions: viewer_pages(),
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
    async fn viewer_sees_overview_pages_but_not_wildcard() {
        let roles = get_role_permissions().await.unwrap();
        let viewer = roles.iter().find(|r| r.name == "Viewer").unwrap();
        assert!(viewer.permissions.contains(&"dashboard".to_string()));
        assert!(viewer.permissions.contains(&"reports".to_string()));
        assert!(viewer.permissions.contains(&"kaizen".to_string()));
        assert!(!viewer.permissions.contains(&"rca".to_string()));
        assert!(!viewer.permissions.contains(&"sync".to_string()));
        assert!(!viewer.permissions.contains(&"*".to_string()));
    }

    #[tokio::test]
    async fn technician_cannot_see_rca() {
        let roles = get_role_permissions().await.unwrap();
        let tech = roles.iter().find(|r| r.name == "Technician").unwrap();
        assert!(tech.permissions.contains(&"downtime".to_string()));
        assert!(tech.permissions.contains(&"kaizen".to_string()));
        assert!(!tech.permissions.contains(&"rca".to_string()));
    }
}
