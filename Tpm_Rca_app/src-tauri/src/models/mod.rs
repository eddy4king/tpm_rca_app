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
    pub cost_per_hour: Option<f64>,
    pub asset_value: Option<f64>,
    pub equipment_type: Option<String>,
    pub parent_id: Option<String>,
    pub area_id: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Plant {
    pub id: String,
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Area {
    pub id: String,
    pub plant_id: String,
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct AuditLog {
    pub id: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub action: String,
    pub description: Option<String>,
    pub performed_by: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct TimelineEvent {
    pub id: String,
    pub event_type: String,
    pub title: String,
    pub equipment_id: Option<String>,
    pub equipment_name: Option<String>,
    pub timestamp: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub meta: Option<String>,
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
    pub priority: Option<String>,
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
    pub recovery_question: Option<String>,
    pub recovery_answer_hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Photo {
    pub id: String,
    pub record_type: String,
    pub record_id: String,
    pub caption: Option<String>,
    pub data: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct FmeaRow {
    pub id: String,
    pub equipment_id: String,
    pub failure_mode: String,
    pub effect: Option<String>,
    pub cause: Option<String>,
    pub severity: i64,
    pub occurrence: i64,
    pub detection: i64,
    pub rpn: i64,
    pub action: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct KnowledgeNote {
    pub id: String,
    pub equipment_id: Option<String>,
    pub title: String,
    pub body: Option<String>,
    pub tags: Option<String>,
    pub category: Option<String>,
    pub author: Option<String>,
    pub attachments: Option<String>,
    pub is_draft: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct ConditionRule {
    pub id: String,
    pub equipment_id: Option<String>,
    pub name: String,
    pub min_mtbf_minutes: Option<i64>,
    pub min_rul_minutes: Option<i64>,
    pub max_failure_count: Option<i64>,
    pub max_downtime_minutes: Option<i64>,
    pub max_avg_mttr_minutes: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct InventoryItem {
    pub id: String,
    pub part_number: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub qty_on_hand: f64,
    pub reorder_level: f64,
    pub reorder_qty: f64,
    pub unit_cost: Option<f64>,
    pub location: Option<String>,
    pub supplier_id: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct InventoryTransaction {
    pub id: String,
    pub item_id: String,
    pub txn_type: String,
    pub qty: f64,
    pub wo_id: Option<String>,
    pub user_id: Option<String>,
    pub note: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct WorkOrder {
    pub id: String,
    pub wo_number: String,
    pub title: String,
    pub description: Option<String>,
    pub equipment_id: Option<String>,
    pub wo_type: String,
    pub source_id: Option<String>,
    pub status: String,
    pub priority: String,
    pub requested_by: Option<String>,
    pub assigned_to: Option<String>,
    pub planned_start: Option<String>,
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub approval_status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct WoLabor {
    pub id: String,
    pub wo_id: String,
    pub person_name: Option<String>,
    pub minutes: f64,
    pub rate: Option<f64>,
    pub note: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct WoPart {
    pub id: String,
    pub wo_id: String,
    pub item_id: Option<String>,
    pub part_number: Option<String>,
    pub qty: f64,
    pub unit_cost: Option<f64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Notification {
    pub id: String,
    pub user_id: Option<String>,
    pub channel: String,
    pub ntype: String,
    pub title: String,
    pub body: Option<String>,
    pub ref_id: Option<String>,
    pub read: i64,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct NotificationPref {
    pub user_id: String,
    pub in_app: i64,
    pub email: i64,
    pub sms: i64,
    pub push: i64,
    pub pm_due: i64,
    pub threshold_breach: i64,
    pub wo_overdue: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct ReportSchedule {
    pub id: String,
    pub name: String,
    pub dataset: String,
    pub format: String,
    pub frequency: String,
    pub recipients: Option<String>,
    pub last_run: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CbmTrigger {
    pub equipment_id: String,
    pub tag_number: Option<String>,
    pub name: Option<String>,
    pub severity: String,
    pub reasons: Vec<String>,
    pub mtbf: f64,
    pub mttr: f64,
    pub failure_count: i64,
    pub rul: Option<f64>,
    pub total_downtime_min: i64,
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