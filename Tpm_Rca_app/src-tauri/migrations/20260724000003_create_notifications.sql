CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    channel TEXT NOT NULL DEFAULT 'in_app',
    ntype TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    ref_id TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notif_ref ON notifications(ref_id, ntype);

CREATE TABLE notification_prefs (
    user_id TEXT PRIMARY KEY,
    in_app INTEGER NOT NULL DEFAULT 1,
    email INTEGER NOT NULL DEFAULT 0,
    sms INTEGER NOT NULL DEFAULT 0,
    push INTEGER NOT NULL DEFAULT 0,
    pm_due INTEGER NOT NULL DEFAULT 1,
    threshold_breach INTEGER NOT NULL DEFAULT 1,
    wo_overdue INTEGER NOT NULL DEFAULT 1
);
