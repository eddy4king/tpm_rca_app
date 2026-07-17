use serde::Serialize;
use reqwest::Client;
use tauri::command;
use tauri::State;
use crate::session::{SessionState, enforce};

#[derive(Serialize)]
pub struct IssuePayload {
    pub title: String,
    pub description: String,
    pub source: String, // e.g., "TPM-RCA"
}

/// Sends a POST request to a configured webhook URL.
/// The webhook URL is read from the environment variable `INTEGRATION_WEBHOOK_URL`.
/// Returns `Ok(())` on HTTP 2xx, otherwise an error `String`.
#[command]
pub async fn create_issue(
    session: State<'_, SessionState>,
    title: String,
    description: String,
) -> Result<(), String> {
    enforce(&session, "Engineer")?;
    // Retrieve webhook URL – error if not set or empty.
    let webhook = std::env::var("INTEGRATION_WEBHOOK_URL")
        .map_err(|e| format!("Missing INTEGRATION_WEBHOOK_URL: {}", e))?;
    if webhook.trim().is_empty() {
        return Err("Integration webhook URL is empty".into());
    }

    let payload = IssuePayload {
        title,
        description,
        source: "TPM-RCA".into(),
    };

    // Use async client to send the request.
    let client = Client::new();
    let resp = client
        .post(&webhook)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send webhook request: {}", e))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("Webhook failed with status {}", resp.status()))
    }
}
