CREATE TABLE downtime (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT ,
    loss_category TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER,
    reported_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);