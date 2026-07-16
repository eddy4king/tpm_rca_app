use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// Claims embedded in the session JWT.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject – the user id.
    pub sub: String,
    /// The user's role at issue time.
    pub role: String,
    /// Expiry (unix seconds).
    pub exp: usize,
}

/// Returns the signing secret. In production this MUST be provided via the
/// `JWT_SECRET` environment variable; a development fallback keeps local runs
/// working without configuration.
fn secret() -> String {
    std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "tpm-rca-dev-secret-change-me".to_string())
}

/// Creates a signed JWT for a user, valid for `valid_days` days.
pub fn create_jwt(user_id: &str, role: &str, valid_days: i64) -> Result<String, String> {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(valid_days))
        .ok_or("Failed to compute token expiry")?
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret().as_bytes()),
    )
    .map_err(|e| format!("Failed to sign token: {}", e))
}

/// Verifies a JWT's signature and expiry, returning its claims.
pub fn verify_jwt(token: &str) -> Result<Claims, String> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret().as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| format!("Invalid token: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jwt_roundtrip_preserves_claims() {
        let token = create_jwt("user-1", "Engineer", 7).unwrap();
        let claims = verify_jwt(&token).unwrap();
        assert_eq!(claims.sub, "user-1");
        assert_eq!(claims.role, "Engineer");
    }

    #[test]
    fn tampered_token_is_rejected() {
        let mut token = create_jwt("user-1", "Admin", 7).unwrap();
        token.push('x'); // corrupt the signature
        assert!(verify_jwt(&token).is_err());
    }

    #[test]
    fn already_expired_token_is_rejected() {
        // Negative validity => exp in the past.
        let token = create_jwt("user-1", "Viewer", -1).unwrap();
        assert!(verify_jwt(&token).is_err());
    }
}
