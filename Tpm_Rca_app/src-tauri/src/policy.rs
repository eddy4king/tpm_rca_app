// Role based policies for the application

use lazy_static::lazy_static;
use std::collections::HashMap;

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Role {
    Admin,
    Engineer,
    Technician,
    Viewer,
}

// Convert a role string (e.g., from the DB or JWT) into the enum.
impl From<&str> for Role {
    fn from(s: &str) -> Self {
        match s {
            "Admin" => Role::Admin,
            "Engineer" => Role::Engineer,
            "Technician" => Role::Technician,
            _ => Role::Viewer,
        }
    }
}

// Map each permission name used by the UI to the minimal role required.
lazy_static! {
    static ref PERM_ROLE: HashMap<&'static str, Role> = {
        let mut m = HashMap::new();
        // Core TPM modules
        m.insert("rca", Role::Engineer);
        m.insert("capa", Role::Engineer);
        m.insert("pm", Role::Technician);
        m.insert("dashboard", Role::Engineer);
        m.insert("downtime", Role::Technician);
        // Add more permissions here as new modules are introduced.
        m
    };
}

/// Returns true if `user_role` is allowed to perform an action that requires `required_permission`.
/// `required_permission` can be a permission string (e.g., "rca") or a role name. The function first
/// resolves the permission to the minimal role using `PERM_ROLE`. Unknown permissions fall back to Viewer.
pub fn permits(user_role: &str, required_permission: &str) -> bool {
    let user = Role::from(user_role);
    // Admin can do everything
    if let Role::Admin = user {
        return true;
    }

    // Resolve the required permission to a Role. If the permission is not in the map,
    // treat it as a role name (fallback to Role::from) – this keeps compatibility with the
    // previous `permits(user_role, Role)` signature used elsewhere.
    let required_role = PERM_ROLE
        .get(required_permission)
        .copied()
        .unwrap_or_else(|| Role::from(required_permission));

    match (user, required_role) {
        // Engineer can act as Engineer, Technician and Viewer
        (Role::Engineer, Role::Engineer)
        | (Role::Engineer, Role::Technician)
        | (Role::Engineer, Role::Viewer) => true,
        // Technician can act as Technician and Viewer
        (Role::Technician, Role::Technician) | (Role::Technician, Role::Viewer) => true,
        // Viewer can only view
        (Role::Viewer, Role::Viewer) => true,
        // Anything else is denied
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_can_do_everything() {
        assert!(permits("Admin", "rca"));
        assert!(permits("Admin", "capa"));
        assert!(permits("Admin", "anything-unknown"));
    }

    #[test]
    fn engineer_permissions() {
        assert!(permits("Engineer", "rca"));
        assert!(permits("Engineer", "capa"));
        assert!(permits("Engineer", "downtime")); // technician-level allowed
        assert!(permits("Engineer", "pm"));
    }

    #[test]
    fn technician_is_limited() {
        assert!(permits("Technician", "downtime"));
        assert!(permits("Technician", "pm"));
        // Technician cannot access engineer-only modules.
        assert!(!permits("Technician", "rca"));
        assert!(!permits("Technician", "capa"));
    }

    #[test]
    fn viewer_can_only_view() {
        assert!(!permits("Viewer", "rca"));
        assert!(!permits("Viewer", "downtime"));
        assert!(permits("Viewer", "Viewer"));
    }

    #[test]
    fn unknown_role_defaults_to_viewer() {
        assert!(!permits("Nonsense", "rca"));
    }
}
