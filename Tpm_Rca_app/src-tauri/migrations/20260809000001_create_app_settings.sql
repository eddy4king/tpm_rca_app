CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('llm_enabled', 'false'),
    ('llm_provider', 'ollama'),
    ('llm_base_url', 'http://localhost:11434'),
    ('llm_model', 'llama3.2'),
    ('llm_api_key', '');