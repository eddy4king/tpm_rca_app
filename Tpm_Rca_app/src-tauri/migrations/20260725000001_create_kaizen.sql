-- Kaizen / Continuous Improvement (CIP) suggestions and OEE leaderboard support.
CREATE TABLE IF NOT EXISTS kaizen_suggestions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    submitted_by TEXT,
    area_id TEXT,
    status TEXT NOT NULL DEFAULT 'Submitted',
    votes INTEGER NOT NULL DEFAULT 0,
    implemented_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kaizen_status ON kaizen_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_kaizen_area ON kaizen_suggestions(area_id);
