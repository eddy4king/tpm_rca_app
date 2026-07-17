CREATE TABLE IF NOT EXISTS fmea (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  failure_mode TEXT NOT NULL,
  effect TEXT,
  cause TEXT,
  severity INTEGER,
  occurrence INTEGER,
  detection INTEGER,
  rpn INTEGER,
  action TEXT,
  owner TEXT,
  status TEXT DEFAULT 'Open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
