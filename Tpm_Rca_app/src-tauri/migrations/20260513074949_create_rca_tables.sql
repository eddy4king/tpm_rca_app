CREATE TABLE rca_investigations  (
    id TEXT PRIMARY KEY,
    downtime_id TEXT,
    equipment_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT ,
    status TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rca_nodes (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL,
    parent_id TEXT,
    node_type TEXT,
    gate_type TEXT,
    title TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
