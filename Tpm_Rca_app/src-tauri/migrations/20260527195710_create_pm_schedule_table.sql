CREATE TABLE pm_schedule (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE ,
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL DEFAULT 'Monthly',
    next_due_date TEXT,
    last_completed_at TEXT,
    assigned_to TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    attachments TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
