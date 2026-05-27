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
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (investigation_id) REFERENCES rca_investigations(id) ON DELETE CASCADE
);

-- Optional but recommended indexes
CREATE INDEX IF NOT EXISTS idx_capa_investigation ON capa(investigation_id);
CREATE INDEX IF NOT EXISTS idx_capa_status ON capa(status);
CREATE INDEX IF NOT EXISTS idx_capa_due_date ON capa(due_date);