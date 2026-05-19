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
