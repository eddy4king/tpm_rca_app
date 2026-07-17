-- Core application tables (equipment, hierarchy, auth, RCA/FMEA/CAPA, PM, audit, sync).
-- Mirrors the structs in src-tauri/src/models/mod.rs. Must run after the
-- existing downtime migration. Columns are nullable where the model uses
-- Option<String>/Option<i64>; "required" model fields are NOT NULL with a
-- safe default so commands that omit them still insert successfully.

CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    tag_number TEXT,
    name TEXT,
    description TEXT,
    location TEXT,
    criticality TEXT,
    status TEXT,
    equipment_type TEXT,
    parent_id TEXT,
    area_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plant (
    id TEXT PRIMARY KEY,
    name TEXT,
    code TEXT,
    description TEXT,
    location TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS area (
    id TEXT PRIMARY KEY,
    plant_id TEXT,
    name TEXT,
    code TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT,
    recovery_question TEXT,
    recovery_answer_hash TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fmea (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    failure_mode TEXT NOT NULL,
    effect TEXT,
    cause TEXT,
    severity INTEGER NOT NULL DEFAULT 1,
    occurrence INTEGER NOT NULL DEFAULT 1,
    detection INTEGER NOT NULL DEFAULT 1,
    rpn INTEGER NOT NULL DEFAULT 1,
    action TEXT,
    owner TEXT,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rca_investigations (
    id TEXT PRIMARY KEY,
    downtime_id TEXT,
    equipment_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Open',
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rca_nodes (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL,
    parent_id TEXT,
    node_type TEXT,
    gate_type TEXT,
    title TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    x_pos REAL NOT NULL DEFAULT 0,
    y_pos REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capa (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    owner TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Open',
    priority TEXT NOT NULL DEFAULT 'Medium',
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_schedule (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    frequency TEXT,
    next_due_date TEXT,
    last_completed_at TEXT,
    assigned_to TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    priority TEXT NOT NULL DEFAULT 'Medium',
    attachments TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL,
    description TEXT,
    performed_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timeline_event (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    equipment_id TEXT,
    equipment_name TEXT,
    timestamp TEXT,
    status TEXT,
    priority TEXT,
    meta TEXT
);

CREATE TABLE IF NOT EXISTS sync_config (
    id TEXT PRIMARY KEY,
    postgres_url TEXT,
    auto_sync INTEGER NOT NULL DEFAULT 0,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 30,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the single sync_config row so get_sync_config / update_sync_config
-- (which key off id = 'default') work on a fresh database.
INSERT INTO sync_config (id, postgres_url, auto_sync, sync_interval_minutes, created_at)
SELECT 'default', NULL, 0, 30, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sync_config WHERE id = 'default');
