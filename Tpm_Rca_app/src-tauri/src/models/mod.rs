use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Equipment {
    pub id: String,
    pub tag_number: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub criticality: Option<String>,
    pub status: Option<String>,
    pub equipment_type: Option<String>,
    pub parent_id: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}


#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Downtime {
    pub id: String,
    pub equipment_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub loss_category: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: Option<i64>,
    pub reported_by: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct RcaInvestigation {
    pub id: String,
    pub downtime_id: Option<String>,
    pub equipment_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub created_by: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct RcaNode {
    pub id: String,
    pub investigation_id: String,
    pub parent_id: Option<String>,
    pub node_type: Option<String>,
    pub gate_type: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub x_pos: f64,
    pub y_pos: f64,
}


#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct CAPA {
    pub id: String,
    pub investigation_id: String,
    pub title: String,
    pub owner: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct PmSchedule {
    pub id: String,
    pub equipment_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub frequency: Option<String>,
    pub next_due_date: Option<String>,
    pub last_completed_at: Option<String>,
    pub assigned_to: Option<String>,
    pub status: Option<String>,
    pub attachments: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SyncConfig {
    pub id: String,
    pub postgres_url: Option<String>,
    pub auto_sync: i64,
    pub sync_interval_minutes: i64,
    pub last_synced_at: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SyncLog {
    pub id: String,
    pub table_name: String,
    pub record_id: String,
    pub operation: String,
    pub payload: String,
    pub synced: i64,
    pub error: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub role: String,
    pub is_active: i64,
    pub created_at: Option<String>,
    pub last_login_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: String,
    pub created_at: Option<String>,
}

// Safe user struct — never exposes password_hash to frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SafeUser {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub is_active: i64,
    pub created_at: Option<String>,
    pub last_login_at: Option<String>,
}