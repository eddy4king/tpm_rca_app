-- Photos attached to downtime events and RCA investigations (shop-floor capture).
-- Images are stored as base64 data URLs in a TEXT column so the app stays
-- fully offline and portable; the same table can link to any record via
-- record_type + record_id.

CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    caption TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_record ON photos (record_type, record_id);
