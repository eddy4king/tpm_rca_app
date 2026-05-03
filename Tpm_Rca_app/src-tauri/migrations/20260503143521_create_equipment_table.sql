CREATE TABLE equipment (
    id TEXT PRIMARY KEY,
    tag_number TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT ,
    location TEXT NOT NULL,
    criticality TEXT NOT NULL,
    status TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);