-- Migration version 20260802000001: Create photos table

CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    caption TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_record ON photos(record_type, record_id);
