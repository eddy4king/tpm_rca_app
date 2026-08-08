use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::State;
use crate::session::{SessionState, enforce};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub enabled: bool,
    pub provider: String,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetLlmConfigPayload {
    pub enabled: Option<bool>,
    pub provider: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

const DEFAULTS: [(&str, &str); 5] = [
    ("llm_enabled", "false"),
    ("llm_provider", "ollama"),
    ("llm_base_url", "http://localhost:11434"),
    ("llm_model", "llama3.2"),
    ("llm_api_key", ""),
];

async fn read_settings(pool: &SqlitePool) -> Result<[String; 5], String> {
    let rows = sqlx::query("SELECT key, value FROM app_settings")
        .fetch_all(pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    let mut out = DEFAULTS.map(|(_, v)| v.to_string());
    for row in rows {
        let key: String = row.get("key");
        let value: String = row.get("value");
        for (i, (k, _)) in DEFAULTS.iter().enumerate() {
            if *k == key {
                out[i] = value.clone();
            }
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn get_llm_config(
    pool: State<'_, SqlitePool>,
) -> Result<LlmConfig, String> {
    let s = read_settings(&pool).await?;
    Ok(LlmConfig {
        enabled: s[0] == "true" || s[0] == "1",
        provider: s[1].clone(),
        base_url: s[2].clone(),
        model: s[3].clone(),
        api_key: s[4].clone(),
    })
}

#[tauri::command]
pub async fn set_llm_config(
    pool: State<'_, SqlitePool>,
    session: State<'_, SessionState>,
    payload: SetLlmConfigPayload,
) -> Result<LlmConfig, String> {
    enforce(&session, "Admin")?;
    let s = read_settings(&pool).await?;
    let mut cfg = LlmConfig {
        enabled: s[0] == "true" || s[0] == "1",
        provider: s[1].clone(),
        base_url: s[2].clone(),
        model: s[3].clone(),
        api_key: s[4].clone(),
    };
    if let Some(v) = payload.enabled { cfg.enabled = v; }
    if let Some(v) = payload.provider {
        if v != "ollama" && v != "openai" {
            return Err("Provider must be 'ollama' or 'openai'".to_string());
        }
        cfg.provider = v;
    }
    if let Some(v) = payload.base_url { cfg.base_url = v; }
    if let Some(v) = payload.model { cfg.model = v; }
    if let Some(v) = payload.api_key { cfg.api_key = v; }

    let values: [(&str, &str); 5] = [
        ("llm_enabled", if cfg.enabled { "true" } else { "false" }),
        ("llm_provider", &cfg.provider),
        ("llm_base_url", &cfg.base_url),
        ("llm_model", &cfg.model),
        ("llm_api_key", &cfg.api_key),
    ];
    for (k, v) in values {
        sqlx::query(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .bind(k)
        .bind(v)
        .execute(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    }
    Ok(cfg)
}

fn system_prompt(page: &str) -> String {
    format!(
        "You are Ruca, the assistant inside TPM-RCA, a Tauri desktop app for Total Productive Maintenance and Root Cause Analysis. \
         It has these modules: Dashboard, Equipment, Hierarchy, Downtime, RCA (root cause analysis), CAPA, PM Scheduler, Tasks, Timeline, Audit, FMEA, CBM (condition-based maintenance), Knowledge, Financials, Inventory, Work Orders, Timesheets, Reports, Sync (Postgres + LAN peer), Users, and Kaizen (continuous improvement). \
         The user is currently on the page: {page}. Be concise (1-3 sentences where possible), practical, and maintenance-domain focused. If the question is outside TPM/RCA, answer briefly from general knowledge.",
        page = page.replace('{', "(").replace('}', ")")
    )
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaResponseMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaResponseMessage {
    content: String,
}

/// Asks the configured LLM. Returns Err with a friendly message if not
/// configured, so the frontend can fall back to the offline knowledge base.
#[tauri::command]
pub async fn ask_llm(
    pool: State<'_, SqlitePool>,
    message: String,
    page: Option<String>,
    history: Option<Vec<ChatMessage>>,
) -> Result<String, String> {
    let cfg = get_llm_config(pool).await?;
    if !cfg.enabled {
        return Err("offline".to_string());
    }

    let page_hint = page.unwrap_or_default();
    let mut messages: Vec<ChatMessage> = vec![ChatMessage {
        role: "system".to_string(),
        content: system_prompt(&page_hint),
    }];
    if let Some(h) = history {
        messages.extend(h.into_iter().filter(|m| m.role == "user" || m.role == "assistant"));
    }
    messages.push(ChatMessage { role: "user".to_string(), content: message });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e: reqwest::Error| format!("HTTP client error: {}", e))?;

    let answer = if cfg.provider == "ollama" {
        let url = format!("{}/api/chat", cfg.base_url.trim_end_matches('/'));
        let payload = serde_json::json!({
            "model": cfg.model,
            "messages": messages,
            "stream": false,
        });
        let resp = client.post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Could not reach Ollama at {}: {}", cfg.base_url, e))?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama returned {}: {}", status, body));
        }
        let parsed: OllamaChatResponse = resp.json().await.map_err(|e| format!("Bad Ollama response: {}", e))?;
        parsed.message.content
    } else {
        let url = format!("{}/v1/chat/completions", cfg.base_url.trim_end_matches('/'));
        let payload = serde_json::json!({
            "model": cfg.model,
            "messages": messages,
        });
        let mut req = client.post(&url).json(&payload);
        if !cfg.api_key.is_empty() {
            req = req.bearer_auth(&cfg.api_key);
        }
        let resp = req.send().await
            .map_err(|e| format!("Could not reach the API at {}: {}", cfg.base_url, e))?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API returned {}: {}", status, body));
        }
        let parsed: ChatCompletionResponse = resp.json().await.map_err(|e| format!("Bad API response: {}", e))?;
        parsed.choices.into_iter().next().map(|c| c.message.content).unwrap_or_default()
    };

    if answer.trim().is_empty() {
        return Err("The model returned an empty reply.".to_string());
    }
    Ok(answer.trim().to_string())
}