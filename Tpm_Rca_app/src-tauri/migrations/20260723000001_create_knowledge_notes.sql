CREATE TABLE knowledge_notes (
    id          TEXT PRIMARY KEY,
    equipment_id TEXT,
    title       TEXT NOT NULL,
    body        TEXT,
    tags        TEXT,
    category    TEXT,
    author      TEXT,
    attachments TEXT,
    is_draft    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
);

CREATE INDEX idx_knowledge_equipment ON knowledge_notes(equipment_id);
CREATE INDEX idx_knowledge_category ON knowledge_notes(category);
