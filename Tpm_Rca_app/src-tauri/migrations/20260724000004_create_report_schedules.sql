CREATE TABLE report_schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dataset TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'csv',
    frequency TEXT NOT NULL DEFAULT 'weekly',
    recipients TEXT,
    last_run TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_report_dataset ON report_schedules(dataset);
