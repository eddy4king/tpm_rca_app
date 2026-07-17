CREATE TABLE IF NOT EXISTS condition_rules (
  id TEXT PRIMARY KEY,
  equipment_id TEXT,
  name TEXT NOT NULL,
  min_mtbf_minutes INTEGER,
  min_rul_minutes INTEGER,
  max_failure_count INTEGER,
  max_downtime_minutes INTEGER,
  max_avg_mttr_minutes INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
