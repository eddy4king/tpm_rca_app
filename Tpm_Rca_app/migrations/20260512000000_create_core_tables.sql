-- Creates all core application tables that previously had no migration.
-- Uses IF NOT EXISTS so this is safe to apply to existing databases that
-- may already contain some of these tables (created manually during dev).

CREATE TABLE IF NOT EXISTS plants (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    code        TEXT,
    description TEXT,
    location    TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas (
    id          TEXT PRIMARY KEY,
    plant_id    TEXT NOT NULL,
    name        TEXT,
    code        TEXT,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment (
    id             TEXT PRIMARY KEY,
    tag_number     TEXT,
    name           TEXT,
    description    TEXT,
    location       TEXT,
    criticality    TEXT,
    status         TEXT,
    equipment_type TEXT,
    parent_id      TEXT,
    area_id        TEXT,
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS rca_investigations (
    id           TEXT PRIMARY KEY,
    downtime_id  TEXT,
    equipment_id TEXT NOT NULL,
    title        TEXT,
    description  TEXT,
    status       TEXT,
    created_by   TEXT,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS rca_nodes (
    id               TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL,
    parent_id        TEXT,
    node_type        TEXT,
    gate_type        TEXT,
    title            TEXT,
    description      TEXT,
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    x_pos            REAL NOT NULL DEFAULT 0,
    y_pos            REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capa (
    id               TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL,
    title            TEXT NOT NULL,
    owner            TEXT NOT NULL,
    description      TEXT,
    status           TEXT NOT NULL,
    priority         TEXT NOT NULL,
    due_date         TEXT,
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_schedule (
    id                TEXT PRIMARY KEY,
    equipment_id      TEXT NOT NULL,
    title             TEXT,
    description       TEXT,
    frequency         TEXT,
    next_due_date     TEXT,
    last_completed_at TEXT,
    assigned_to       TEXT,
    status            TEXT,
    priority          TEXT,
    attachments       TEXT,
    created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id           TEXT PRIMARY KEY,
    entity_type  TEXT NOT NULL,
    entity_id    TEXT,
    action       TEXT NOT NULL,
    description  TEXT,
    performed_by TEXT,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    username             TEXT NOT NULL UNIQUE,
    email                TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    role                 TEXT NOT NULL,
    is_active            INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at        TEXT,
    recovery_question    TEXT,
    recovery_answer_hash TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_config (
    id                    TEXT PRIMARY KEY,
    postgres_url          TEXT,
    auto_sync             INTEGER NOT NULL DEFAULT 0,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    last_synced_at        TEXT,
    created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_log (
    id         TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id  TEXT NOT NULL,
    operation  TEXT NOT NULL,
    payload    TEXT NOT NULL,
    synced     INTEGER NOT NULL DEFAULT 0,
    error      TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the singleton sync configuration row expected by the sync engine.
INSERT OR IGNORE INTO sync_config (id, auto_sync, sync_interval_minutes)
VALUES ('default', 0, 15);

-- Helpful indexes for common lookups.
CREATE INDEX IF NOT EXISTS idx_areas_plant           ON areas(plant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_area        ON equipment(area_id);
CREATE INDEX IF NOT EXISTS idx_downtime_equipment    ON downtime(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rca_inv_equipment     ON rca_investigations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rca_nodes_inv         ON rca_nodes(investigation_id);
CREATE INDEX IF NOT EXISTS idx_capa_investigation    ON capa(investigation_id);
CREATE INDEX IF NOT EXISTS idx_pm_equipment          ON pm_schedule(equipment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token        ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sync_log_synced       ON sync_log(synced);
CREATE INDEX IF NOT EXISTS idx_audit_entity          ON audit_log(entity_type, entity_id);
