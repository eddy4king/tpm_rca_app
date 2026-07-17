// Server-side session/role tracking for backend RBAC enforcement.
//
// Tauri injects `State<SessionState>` into commands automatically, so no
// frontend changes are required: the role is captured at login / session
// validation time and cleared on logout.

use std::sync::Mutex;

use crate::policy::permits;

#[derive(Default)]
pub struct SessionState {
    pub inner: Mutex<SessionInner>,
}

#[derive(Default, Clone)]
pub struct SessionInner {
    pub user_id: Option<String>,
    pub role: Option<String>,
}

impl SessionState {
    pub fn set(&self, user_id: Option<String>, role: Option<String>) {
        if let Ok(mut s) = self.inner.lock() {
            s.user_id = user_id;
            s.role = role;
        }
    }

    pub fn clear(&self) {
        self.set(None, None);
    }

    pub fn current_role(&self) -> String {
        self.inner
            .lock()
            .ok()
            .and_then(|s| s.role.clone())
            .unwrap_or_else(|| "Viewer".to_string())
    }

    pub fn current_user_id(&self) -> Option<String> {
        self.inner.lock().ok().and_then(|s| s.user_id.clone())
    }
}

/// Enforce that the active session's role may perform an action requiring
/// `required` (a role name like "Engineer" or a permission key like "rca").
pub fn enforce(session: &SessionState, required: &str) -> Result<(), String> {
    let role = session.current_role();
    if permits(&role, required) {
        Ok(())
    } else {
        Err(format!("Permission denied: requires '{}' role", required))
    }
}

/// Enforce that the active session belongs to `user_id` OR the session role is
/// `Admin`. Used for self-service actions (change own password, set recovery).
pub fn enforce_self_or_admin(session: &SessionState, user_id: &str) -> Result<(), String> {
    if let Some(current) = session.current_user_id() {
        if current == user_id {
            return Ok(());
        }
    }
    enforce(session, "Admin")
}
