use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use crate::models::KnowledgeNote;
use crate::commands::audit::record_audit;
use crate::session::{SessionState, enforce};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeNotePayload {
    pub equipment_id: Option<String>,
    pub title: String,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
    pub author: Option<String>,
    pub attachments: Option<Vec<String>>,
    pub is_draft: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKnowledgeNotePayload {
    pub id: String,
    pub equipment_id: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
    pub author: Option<String>,
    pub attachments: Option<Vec<String>>,
    pub is_draft: Option<bool>,
}

fn json_or_empty(list: Option<Vec<String>>) -> Option<String> {
    list.map(|l| serde_json::to_string(&l).unwrap_or_else(|_| "[]".to_string()))
}

#[tauri::command]
pub async fn create_knowledge_note(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: CreateKnowledgeNotePayload,
) -> Result<KnowledgeNote, String> {
    enforce(&session, "Engineer")?;
    let id = Uuid::new_v4().to_string();
    let tags_json = json_or_empty(payload.tags);
    let att_json = json_or_empty(payload.attachments);
    let is_draft = payload.is_draft.unwrap_or(false) as i64;

    sqlx::query(
        "INSERT INTO knowledge_notes (id, equipment_id, title, body, tags, category, author, attachments, is_draft)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
    .bind(&id)
    .bind(&payload.equipment_id)
    .bind(&payload.title)
    .bind(&payload.body)
    .bind(&tags_json)
    .bind(&payload.category)
    .bind(&payload.author)
    .bind(&att_json)
    .bind(is_draft)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(
        &pool,
        "knowledge",
        Some(&id),
        "create",
        &format!("Knowledge note '{}' added", payload.title),
        payload.author.as_deref(),
    )
    .await
    .ok();

    let note = sqlx::query_as::<_, KnowledgeNote>("SELECT * FROM knowledge_notes WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(note)
}

#[tauri::command]
pub async fn get_knowledge_notes(
    pool: State<'_, SqlitePool>,
    equipment_id: Option<String>,
) -> Result<Vec<KnowledgeNote>, String> {
    let notes: Vec<KnowledgeNote> = match equipment_id {
        Some(eid) => sqlx::query_as("SELECT * FROM knowledge_notes WHERE equipment_id = ?1 ORDER BY created_at DESC")
            .bind(&eid)
            .fetch_all(&*pool)
            .await,
        None => sqlx::query_as("SELECT * FROM knowledge_notes ORDER BY created_at DESC")
            .fetch_all(&*pool)
            .await,
    }
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(notes)
}

#[tauri::command]
pub async fn get_knowledge_note(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<KnowledgeNote, String> {
    let note = sqlx::query_as::<_, KnowledgeNote>("SELECT * FROM knowledge_notes WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(note)
}

#[tauri::command]
pub async fn update_knowledge_note(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: UpdateKnowledgeNotePayload,
) -> Result<KnowledgeNote, String> {
    enforce(&session, "Engineer")?;
    let tags_json = json_or_empty(payload.tags);
    let att_json = json_or_empty(payload.attachments);
    let is_draft = payload.is_draft.map(|d| d as i64);

    sqlx::query(
        "UPDATE knowledge_notes SET
            equipment_id = COALESCE(?1, equipment_id),
            title = COALESCE(?2, title),
            body = COALESCE(?3, body),
            tags = COALESCE(?4, tags),
            category = COALESCE(?5, category),
            author = COALESCE(?6, author),
            attachments = COALESCE(?7, attachments),
            is_draft = COALESCE(?8, is_draft),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?9"
    )
    .bind(&payload.equipment_id)
    .bind(&payload.title)
    .bind(&payload.body)
    .bind(&tags_json)
    .bind(&payload.category)
    .bind(&payload.author)
    .bind(&att_json)
    .bind(is_draft)
    .bind(&payload.id)
    .execute(&*pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(
        &pool,
        "knowledge",
        Some(&payload.id),
        "update",
        &format!("Knowledge note '{}' updated", payload.title.clone().unwrap_or_default()),
        payload.author.as_deref(),
    )
    .await
    .ok();

    let note = sqlx::query_as::<_, KnowledgeNote>("SELECT * FROM knowledge_notes WHERE id = ?1")
        .bind(&payload.id)
        .fetch_one(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(note)
}

#[tauri::command]
pub async fn delete_knowledge_note(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    enforce(&session, "Engineer")?;
    sqlx::query("DELETE FROM knowledge_notes WHERE id = ?1")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    record_audit(&pool, "knowledge", Some(&id), "delete", "Knowledge note deleted", None)
        .await
        .ok();

    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchKnowledgePayload {
    pub q: Option<String>,
    pub equipment_id: Option<String>,
    pub category: Option<String>,
    pub tag: Option<String>,
    pub include_drafts: Option<bool>,
    pub limit: Option<i64>,
}

#[tauri::command]
pub async fn search_knowledge_notes(
    pool: State<'_, SqlitePool>,
    payload: SearchKnowledgePayload,
) -> Result<Vec<KnowledgeNote>, String> {
    let mut clauses: Vec<String> = Vec::new();
    if payload.q.is_some() {
        clauses.push("(title LIKE ? OR body LIKE ? OR tags LIKE ?)".to_string());
    }
    if payload.equipment_id.is_some() {
        clauses.push("equipment_id = ?".to_string());
    }
    if payload.category.is_some() {
        clauses.push("category = ?".to_string());
    }
    if payload.tag.is_some() {
        clauses.push("tags LIKE ?".to_string());
    }
    if payload.include_drafts != Some(true) {
        clauses.push("is_draft = 0".to_string());
    }

    let mut sql = String::from("SELECT * FROM knowledge_notes");
    if !clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ?");

    let mut q = sqlx::query_as::<_, KnowledgeNote>(&sql);
    if let Some(v) = payload.q.clone() {
        let like = format!("%{}%", v);
        q = q.bind(like.clone()).bind(like.clone()).bind(like.clone());
    }
    if let Some(v) = payload.equipment_id {
        q = q.bind(v);
    }
    if let Some(v) = payload.category {
        q = q.bind(v);
    }
    if let Some(v) = payload.tag {
        q = q.bind(format!("%\"{}\"%", v.replace('"', "")));
    }
    q = q.bind(payload.limit.unwrap_or(500));

    let notes = q
        .fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(notes)
}
