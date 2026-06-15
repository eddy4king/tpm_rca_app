// Role based policies for the application

#[derive(Debug, PartialEq, Eq)]
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

/// Returns true if `user_role` is allowed to perform an action that requires `required_role`.
#[allow(dead_code)]
pub fn permits(user_role: &str, required_role: Role) -> bool {
    let user = Role::from(user_role);
    match (user, required_role) {
        // Admin can do everything
        (Role::Admin, _) => true,

        // Engineer can act as Engineer, Technician and Viewer
        (Role::Engineer, Role::Engineer) => true,
        (Role::Engineer, Role::Technician) => true,
        (Role::Engineer, Role::Viewer) => true,

        // Technician can act as Technician and Viewer
        (Role::Technician, Role::Technician) => true,
        (Role::Technician, Role::Viewer) => true,

        // Viewer can only view
        (Role::Viewer, Role::Viewer) => true,

        // Anything else is denied
        _ => false,
    }
}
