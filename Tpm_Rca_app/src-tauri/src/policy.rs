// Role based policies for the application

#[derive(Debug, PartialEq, Eq)]
pub enum Role {
    Admin,
    Editor,
    Viewer,
}

impl From<&str> for Role {
    fn from(s: &str) -> Self {
        match s {
            "Admin" => Role::Admin,
            "Editor" => Role::Editor,
            _ => Role::Viewer,
        }
    }
}

/// Returns true if `user_role` is allowed to perform an action that requires `required_role`
pub fn permits(user_role: &str, required_role: Role) -> bool {
    let user = Role::from(user_role);
    match (user, required_role) {
        (Role::Admin, _) => true, // admin can do anything
        (Role::Editor, Role::Editor) => true,
        (Role::Editor, Role::Viewer) => true,
        (Role::Viewer, Role::Viewer) => true,
        _ => false,
    }
}
