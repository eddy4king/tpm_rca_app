use serde::{Deserialize, Serialize};
use sqlx::FromRow;



#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]

pub struct Equipment {
    pub id : String,
    pub tag_number : String,
    pub name : String,
    pub description : Option<String>,
    pub location : String,
    pub criticality : String,
    pub status: String,
    pub equipment_type : String,
    pub parent_id : Option<String>,
    pub created_at : String,
    pub updated_at : String
}
