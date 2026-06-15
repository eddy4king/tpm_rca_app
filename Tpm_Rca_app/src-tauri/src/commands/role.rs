use tauri::State;
use crate::db::init;
use crate::policy::Role;
use serde::Serialize;

#[derive(Serialize)]
pub struct RoleInfo {
    pub name: String,
    pub description: String,
    pub permissions: Vec<String>,
}

#[tauri::command]
pub async fn get_role_permissions() -> Result<Vec<RoleInfo>, String> {
    // Define static role permissions matching the UI and backend policy.
    let roles = vec![
        RoleInfo {
            name: "Admin".into(),
            description: "Full access — manage users, all modules, sync settings".into(),
            permissions: vec!["*".into()], // wildcard – everything allowed
        },
        RoleInfo {
            name: "Engineer".into(),
            description: "RCA, CAPA, PM Scheduler, Dashboard, Downtime — read/write".into(),
            permissions: vec!["rca", "capa", "pm", "dashboard", "downtime"].into_iter().map(|s| s.to_string()).collect(),
        },
        RoleInfo {
            name: "Technician".into(),
            description: "Downtime Logger, PM Scheduler — read/write. Others read-only".into(),
            permissions: vec!["downtime", "pm"].into_iter().map(|s| s.to_string()).collect(),
        },
        RoleInfo {
            name: "Viewer".into(),
            description: "Read-only access to all modules".into(),
            permissions: vec!["read".into()],
        },
    ];
    Ok(roles)
}

