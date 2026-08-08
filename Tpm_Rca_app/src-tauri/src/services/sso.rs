// OIDC / SSO and LDAP login for the desktop app.
//
// OIDC flow (authorization-code, confidential client):
//   1. `begin_sso_login` builds the provider authorize URL, opens it in the
//      system browser, and starts a localhost listener that catches the
//      provider's redirect (SSO_REDIRECT_URI, default http://127.0.0.1:8765/callback).
//   2. The user authenticates; the provider redirects back with `?code=...&state=...`.
//   3. The listener exchanges the code for tokens, cryptographically verifies
//      the id_token signature against the provider JWKS (RS256) and validates
//      issuer/audience/exp, upserts a local user, and creates a normal JWT
//      session. `await_sso_login` returns that session to the frontend.
//
// LDAP flow (simple bind against a DN template):
//   `ldap_login` binds as `<LDAP_USER_DN_TEMPLATE with %s = username>` using the
//   supplied password. On success it upserts a local user and returns a JWT
//   session. TLS/StartTLS is NOT implemented — use an ldap:// URL only on a
//   trusted network, or front it with stunnel/ldaps offload.
//
// Everything is config-gated. When disabled, the login UI shows no extra button.

use base64::Engine as _;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri::async_runtime::JoinHandle;
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SsoConfig {
    pub enabled: bool,
    pub label: String,
    pub issuer: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub jwks_uri: String,
}

impl Default for SsoConfig {
    fn default() -> Self {
        SsoConfig {
            enabled: false,
            label: String::new(),
            issuer: String::new(),
            client_id: String::new(),
            redirect_uri: "http://127.0.0.1:8765/callback".to_string(),
            scope: "openid email profile".to_string(),
            authorization_endpoint: String::new(),
            token_endpoint: String::new(),
            jwks_uri: String::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct LdapConfig {
    pub enabled: bool,
    pub label: String,
}

#[derive(Debug, Deserialize)]
struct Discovery {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    #[serde(default)]
    jwks_uri: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    #[serde(default)]
    id_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JwksKey {
    #[serde(default)]
    kid: Option<String>,
    kty: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<JwksKey>,
}

#[derive(Debug, Deserialize)]
struct IdClaims {
    sub: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

lazy_static! {
    static ref EXPECTED_STATE: Mutex<Option<String>> = Mutex::new(None);
    static ref SSO_HANDLE: Mutex<Option<JoinHandle<Result<(crate::models::SafeUser, String), String>>>> =
        Mutex::new(None);
}

fn env_enabled(key: &str) -> bool {
    matches!(std::env::var(key).as_deref(), Ok("1") | Ok("true") | Ok("TRUE"))
}

/// Reads SSO configuration from the environment and (when enabled) fetches the
/// provider's OIDC discovery document.
pub fn load_sso_config() -> Result<SsoConfig, String> {
    if !env_enabled("SSO_ENABLED") {
        return Ok(SsoConfig::default());
    }
    let issuer = std::env::var("SSO_ISSUER").map_err(|_| "SSO_ISSUER is required when SSO_ENABLED".to_string())?;
    let client_id = std::env::var("SSO_CLIENT_ID").map_err(|_| "SSO_CLIENT_ID is required when SSO_ENABLED".to_string())?;
    let label = std::env::var("SSO_LABEL").unwrap_or_else(|_| "Single Sign-On".to_string());
    let redirect_uri = std::env::var("SSO_REDIRECT_URI")
        .unwrap_or_else(|_| "http://127.0.0.1:8765/callback".to_string());
    let scope = std::env::var("SSO_SCOPE").unwrap_or_else(|_| "openid email profile".to_string());

    let disco = tauri::async_runtime::block_on(discover(&issuer))?;
    Ok(SsoConfig {
        enabled: true,
        label,
        issuer: disco.issuer,
        client_id,
        redirect_uri,
        scope,
        authorization_endpoint: disco.authorization_endpoint,
        token_endpoint: disco.token_endpoint,
        jwks_uri: disco.jwks_uri,
    })
}

pub fn load_ldap_config() -> LdapConfig {
    LdapConfig {
        enabled: env_enabled("LDAP_ENABLED"),
        label: std::env::var("LDAP_LABEL").unwrap_or_else(|_| "LDAP".to_string()),
    }
}

async fn discover(issuer: &str) -> Result<Discovery, String> {
    let well_known = format!("{}/.well-known/openid-configuration", issuer.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .get(&well_known)
        .send()
        .await
        .map_err(|e| format!("SSO discovery failed: {}", e))?;
    resp.json::<Discovery>().await.map_err(|e| format!("Invalid OIDC discovery document: {}", e))
}

async fn fetch_jwks(uri: &str) -> Result<Jwks, String> {
    let resp = reqwest::Client::new()
        .get(uri)
        .send()
        .await
        .map_err(|e| format!("JWKS fetch failed: {}", e))?;
    resp.json::<Jwks>().await.map_err(|e| format!("Invalid JWKS document: {}", e))
}

fn b64url_decode(s: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(s)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(s))
        .map_err(|e| format!("Base64 decode failed: {}", e))
}

/// Verifies the id_token's RS256 signature against the provider JWKS and
/// validates issuer/audience/expiry. Returns (sub, email, name).
async fn verify_id_token(
    token: &str,
    jwks_uri: &str,
    issuer: &str,
    client_id: &str,
) -> Result<(String, String, String), String> {
    use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Malformed id_token".to_string());
    }
    // Header (for the key id).
    let header_json = b64url_decode(parts[0])?;
    let header: serde_json::Value = serde_json::from_slice(&header_json)
        .map_err(|e| format!("Invalid id_token header: {}", e))?;
    let kid = header.get("kid").and_then(|v| v.as_str()).unwrap_or("");

    let jwks = fetch_jwks(jwks_uri).await?;
    let key = jwks
        .keys
        .iter()
        .find(|k| k.kty == "RSA" && (kid.is_empty() || k.kid.as_deref() == Some(kid)))
        .ok_or("No matching JWKS RSA key")?;

    let n = b64url_decode(&key.n)?;
    let e = b64url_decode(&key.e)?;
    let decoding_key = DecodingKey::from_rsa_raw_components(&n, &e);

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[client_id]);
    validation.set_issuer(&[issuer]);
    validation.validate_exp = true;

    let data = decode::<IdClaims>(token, &decoding_key, &validation)
        .map_err(|e| format!("id_token verification failed: {}", e))?;

    let email = data.claims.email.unwrap_or_default();
    let name = data.claims.name.unwrap_or_default();
    Ok((data.claims.sub, email, name))
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// Returns the (possibly disabled) SSO configuration for the login UI.
#[tauri::command]
pub async fn get_sso_config() -> Result<SsoConfig, String> {
    load_sso_config()
}

/// Returns the LDAP configuration for the login UI.
#[tauri::command]
pub async fn get_ldap_config() -> Result<LdapConfig, String> {
    Ok(load_ldap_config())
}

/// Starts the SSO flow: opens the browser and begins listening for the
/// provider redirect. Returns the authorize URL (mostly for debugging).
#[tauri::command]
pub async fn begin_sso_login(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let cfg = load_sso_config()?;
    if !cfg.enabled {
        return Err("SSO is not enabled".to_string());
    }
    let disco = discover(&cfg.issuer).await?;

    let state = Uuid::new_v4().to_string();
    let nonce = Uuid::new_v4().to_string();
    *EXPECTED_STATE.lock().unwrap() = Some(state.clone());

    let auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&nonce={}",
        disco.authorization_endpoint,
        percent_encode(&cfg.client_id),
        percent_encode(&cfg.redirect_uri),
        percent_encode(&cfg.scope),
        percent_encode(&state),
        percent_encode(&nonce),
    );

    // Open the provider in the user's default browser.
    app.opener()
        .open_url(auth_url.clone(), None::<String>)
        .map_err(|e| format!("Failed to open browser for SSO: {}", e))?;

    let pool = pool.inner().clone();
    let cfg_for_task = cfg.clone();
    let disco_for_task = disco;
    let app_for_task = app.clone();
    let handle = tauri::async_runtime::spawn(async move {
        run_sso_callback(app_for_task, pool, &cfg_for_task, &disco_for_task, &state).await
    });
    *SSO_HANDLE.lock().unwrap() = Some(handle);

    Ok(auth_url)
}

/// Awaits the in-flight SSO flow started by `begin_sso_login` and returns the
/// resulting user session, or an error if the flow failed/timed out.
#[tauri::command]
pub async fn await_sso_login() -> Result<(crate::models::SafeUser, String), String> {
    let handle = SSO_HANDLE.lock().unwrap().take().ok_or("No SSO flow in progress")?;
    handle.await.map_err(|e| format!("SSO task failed: {}", e))?
}

fn parse_redirect_hostport(redirect_uri: &str) -> (String, u16) {
    let without_scheme = redirect_uri.split("://").nth(1).unwrap_or(redirect_uri);
    let hostport = without_scheme.split('/').next().unwrap_or("127.0.0.1:8765");
    if let Some((host, port)) = hostport.split_once(':') {
        if let Ok(p) = port.parse::<u16>() {
            return (host.to_string(), p);
        }
    }
    ("127.0.0.1".to_string(), 8765)
}

async fn run_sso_callback(
    app: AppHandle,
    pool: SqlitePool,
    cfg: &SsoConfig,
    disco: &Discovery,
    expected_state: &str,
) -> Result<(crate::models::SafeUser, String), String> {
    let (host, port) = parse_redirect_hostport(&cfg.redirect_uri);
    let listener = tokio::net::TcpListener::bind((host.as_str(), port))
        .await
        .map_err(|e| format!("SSO listener bind failed on {}:{}: {}", host, port, e))?;

    let accept = async {
        let (stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let (read_half, mut write_half) = stream.into_split();
        let mut reader = BufReader::new(read_half);
        let mut request_line = String::new();
        reader.read_line(&mut request_line).await.map_err(|e| e.to_string())?;
        loop {
            let mut l = String::new();
            reader.read_line(&mut l).await.map_err(|e| e.to_string())?;
            if l == "\r\n" || l == "\n" {
                break;
            }
        }
        let html = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><body style='font-family:sans-serif'><h2>You're authenticated</h2><p>You can close this tab and return to TPM-RCA Pro.</p></body></html>";
        let _ = write_half.write_all(html.as_bytes()).await;
        let _ = write_half.flush().await;
        Ok::<String, String>(request_line)
    };

    let request_line = tokio::time::timeout(std::time::Duration::from_secs(300), accept)
        .await
        .map_err(|_| "SSO login timed out".to_string())??;

    let query = request_line
        .split_whitespace()
        .nth(1)
        .and_then(|p| p.split_once('?'))
        .map(|(_, q)| q)
        .unwrap_or("");
    let mut code = None;
    let mut state = None;
    for pair in query.split('&') {
        if let Some(v) = pair.strip_prefix("code=") {
            code = Some(v.to_string());
        } else if let Some(v) = pair.strip_prefix("state=") {
            state = Some(v.to_string());
        }
    }
    let code = code.ok_or("SSO callback missing authorization code".to_string())?;
    if state.as_deref() != Some(expected_state) {
        return Err("SSO state mismatch — possible CSRF".to_string());
    }

    let client_secret = std::env::var("SSO_CLIENT_SECRET").ok().filter(|s| !s.is_empty());
    let mut params = vec![
        ("grant_type", "authorization_code".to_string()),
        ("code", code),
        ("redirect_uri", cfg.redirect_uri.clone()),
        ("client_id", cfg.client_id.clone()),
    ];
    if let Some(secret) = client_secret {
        params.push(("client_secret", secret));
    }
    let token_resp: TokenResponse = reqwest::Client::new()
        .post(&disco.token_endpoint)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("SSO token exchange failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Invalid token response: {}", e))?;

    let id_token = token_resp.id_token.ok_or("SSO provider returned no id_token".to_string())?;
    let (sub, email, _name) = verify_id_token(&id_token, &disco.jwks_uri, &cfg.issuer, &cfg.client_id).await?;
    if sub.is_empty() {
        return Err("SSO id_token missing subject".to_string());
    }

    let user = upsert_external_user(&pool, &sub, if email.is_empty() { None } else { Some(&email) },
        &std::env::var("SSO_ROLE_DEFAULT").unwrap_or_else(|_| "Viewer".to_string())).await?;
    let token = create_session(&pool, &user, app.state::<crate::session::SessionState>().inner()).await?;
    Ok((user, token))
}

// ---------------------------------------------------------------------------
// LDAP simple bind (hand-rolled BER; no external crate). Plaintext ldap:// only.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LdapPayload {
    pub username: String,
    pub password: String,
}

/// Binds as `<LDAP_USER_DN_TEMPLATE with %s = username>` and returns the LDAP
/// result code (0 = success).
async fn ldap_simple_bind(url: &str, dn: &str, password: &str) -> Result<i64, String> {
    let (host, port) = parse_ldap_url(url)?;
    let stream = tokio::net::TcpStream::connect((host, port)).await.map_err(|e| e.to_string())?;
    let packet = build_bind_request(dn, password);
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut stream = stream;
    stream.write_all(&packet).await.map_err(|e| e.to_string())?;
    stream.flush().await.ok();
    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    buf.truncate(n);
    if buf.is_empty() {
        return Err("No response from LDAP server".to_string());
    }
    parse_bind_result(&buf)
}

fn parse_ldap_url(url: &str) -> Result<(String, u16), String> {
    let trimmed = url.trim();
    if trimmed.starts_with("ldaps://") {
        return Err("LDAPS is not supported; use a plaintext ldap:// URL on a trusted network".to_string());
    }
    let rest = trimmed.strip_prefix("ldap://").unwrap_or(trimmed);
    let (host, port) = rest.split_once(':').unwrap_or((rest, "389"));
    let port = port.parse::<u16>().map_err(|_| "Invalid LDAP port".to_string())?;
    if host.is_empty() {
        return Err("Invalid LDAP URL".to_string());
    }
    Ok((host.to_string(), port))
}

fn ber_len(n: usize) -> Vec<u8> {
    if n < 128 {
        vec![n as u8]
    } else {
        let mut bytes = n.to_be_bytes().to_vec();
        while bytes.len() > 1 && bytes[0] == 0 {
            bytes.remove(0);
        }
        let mut out = vec![0x80 | bytes.len() as u8];
        out.extend_from_slice(&bytes);
        out
    }
}

fn ber_tlv(tag: u8, content: &[u8]) -> Vec<u8> {
    let mut v = vec![tag];
    v.extend(ber_len(content.len()));
    v.extend_from_slice(content);
    v
}

fn ber_int(value: i64) -> Vec<u8> {
    if value == 0 {
        return ber_tlv(0x02, &[0x00]);
    }
    let mut bytes = value.to_be_bytes().to_vec();
    while bytes.len() > 1 {
        if bytes[0] == 0x00 && (bytes[1] & 0x80) == 0 {
            bytes.remove(0);
        } else if bytes[0] == 0xFF && (bytes[1] & 0x80) != 0 {
            bytes.remove(0);
        } else {
            break;
        }
    }
    ber_tlv(0x02, &bytes)
}

fn ber_seq(content: &[u8]) -> Vec<u8> {
    ber_tlv(0x30, content)
}

/// Encodes an LDAP BindRequest (RFC 4511) with simple authentication.
fn build_bind_request(dn: &str, password: &str) -> Vec<u8> {
    let mut inner = Vec::new();
    inner.extend(ber_int(3)); // LDAP protocol version
    inner.extend(ber_tlv(0x04, dn.as_bytes())); // name (LDAPDN)
    let simple = ber_tlv(0x04, password.as_bytes());
    inner.extend(ber_tlv(0x80, &simple)); // authentication: simple [0] OCTET STRING
    let bind_req = ber_tlv(0x60, &inner); // BindRequest [APPLICATION 0]

    let mut msg = Vec::new();
    msg.extend(ber_int(1)); // messageID
    msg.extend(bind_req);
    ber_seq(&msg)
}

fn skip_ber_len(data: &[u8], i: usize) -> Result<(usize, usize), String> {
    let b = *data.get(i).ok_or("BER length out of bounds")?;
    if b < 128 {
        Ok((b as usize, i + 1))
    } else {
        let nb = (b & 0x7f) as usize;
        let mut v: usize = 0;
        for k in 0..nb {
            v = (v << 8) | (*data.get(i + 1 + k).ok_or("BER length content oob")? as usize);
        }
        Ok((v, i + 1 + nb))
    }
}

fn read_ber_int(data: &[u8], pos: usize) -> Result<(i64, usize), String> {
    if data.get(pos) != Some(&0x02) {
        return Err("Expected INTEGER tag".to_string());
    }
    let len_byte = *data.get(pos + 1).ok_or("BER int len oob")?;
    let (len, content_pos) = if len_byte < 128 {
        (len_byte as usize, pos + 2)
    } else {
        let nb = (len_byte & 0x7f) as usize;
        let mut v: usize = 0;
        for k in 0..nb {
            v = (v << 8) | (*data.get(pos + 2 + k).ok_or("BER int content oob")? as usize);
        }
        (v, pos + 2 + nb)
    };
    let mut val: i64 = 0;
    for k in 0..len {
        val = (val << 8) | (*data.get(content_pos + k).ok_or("BER int val oob")? as i64);
    }
    if len > 0 && (data[content_pos] & 0x80) != 0 {
        let bits = (len as i64) * 8;
        val -= 1i64 << bits;
    }
    Ok((val, content_pos + len))
}

/// Extracts the resultCode INTEGER from an LDAP BindResponse.
fn parse_bind_result(data: &[u8]) -> Result<i64, String> {
    let pos = data.iter().position(|&b| b == 0x61).ok_or("No LDAP bind response found")?;
    let (_, content_start) = skip_ber_len(data, pos + 1)?;
    if data.get(content_start) != Some(&0x30) {
        return Err("Expected bind result SEQUENCE".to_string());
    }
    let (_, seq_start) = skip_ber_len(data, content_start + 1)?;
    if data.get(seq_start) != Some(&0x02) {
        return Err("Expected resultCode INTEGER".to_string());
    }
    let (val, _) = read_ber_int(data, seq_start)?;
    Ok(val)
}

#[tauri::command]
pub async fn ldap_login(
    pool: State<'_, SqlitePool>,
    session: State<'_, crate::session::SessionState>,
    payload: LdapPayload,
) -> Result<(crate::models::SafeUser, String), String> {
    if !load_ldap_config().enabled {
        return Err("LDAP is not enabled".to_string());
    }
    if payload.username.is_empty() || payload.password.is_empty() {
        return Err("LDAP username and password are required".to_string());
    }
    let url = std::env::var("LDAP_URL").map_err(|_| "LDAP_URL is required when LDAP_ENABLED".to_string())?;
    let template = std::env::var("LDAP_USER_DN_TEMPLATE")
        .map_err(|_| "LDAP_USER_DN_TEMPLATE is required when LDAP_ENABLED".to_string())?;
    if !template.contains("%s") {
        return Err("LDAP_USER_DN_TEMPLATE must contain %s for the username".to_string());
    }
    let dn = template.replace("%s", &payload.username);

    let result_code = ldap_simple_bind(&url, &dn, &payload.password).await?;
    if result_code != 0 {
        return Err(format!("LDAP authentication failed (result code {})", result_code));
    }

    let role_default = std::env::var("LDAP_ROLE_DEFAULT").unwrap_or_else(|_| "Viewer".to_string());
    let user = upsert_external_user(&pool, &payload.username,
        if payload.username.contains('@') { Some(&payload.username) } else { None },
        &role_default).await?;
    let token = create_session(&pool, &user, &session).await?;
    Ok((user, token))
}

// ---------------------------------------------------------------------------
// Shared user/session helpers
// ---------------------------------------------------------------------------

async fn upsert_external_user(
    pool: &SqlitePool,
    login: &str,
    email: Option<&str>,
    role_default: &str,
) -> Result<crate::models::SafeUser, String> {
    if let Ok(existing) = sqlx::query_as::<_, crate::models::User>(
        "SELECT * FROM users WHERE email = ?1 OR username = ?1 LIMIT 1",
    )
    .bind(login)
    .fetch_one(pool)
    .await
    {
        sqlx::query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?1")
            .bind(&existing.id)
            .execute(pool)
            .await
            .ok();
        return Ok(crate::models::SafeUser {
            id: existing.id,
            username: existing.username,
            email: existing.email,
            role: existing.role,
            is_active: existing.is_active,
            created_at: existing.created_at,
            last_login_at: existing.last_login_at,
        });
    }

    let id = Uuid::new_v4().to_string();
    let password_hash = bcrypt::hash(Uuid::new_v4().to_string(), bcrypt::DEFAULT_COST)
        .map_err(|e| e.to_string())?;
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
    )
    .bind(&id)
    .bind(login)
    .bind(email)
    .bind(&password_hash)
    .bind(role_default)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(crate::models::SafeUser {
        id,
        username: login.to_string(),
        email: email.unwrap_or("").to_string(),
        role: role_default.to_string(),
        is_active: 1,
        created_at: None,
        last_login_at: None,
    })
}

async fn create_session(
    pool: &SqlitePool,
    user: &crate::models::SafeUser,
    session: &crate::session::SessionState,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let token = crate::services::jwt::create_jwt(&user.id, &user.role, 7)?;
    let expires_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap()
        .to_rfc3339();
    sqlx::query(
        "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(&session_id)
    .bind(&user.id)
    .bind(&token)
    .bind(&expires_at)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    session.set(Some(user.id.clone()), Some(user.role.clone()));
    Ok(token)
}
