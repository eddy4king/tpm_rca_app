-- Production logs: capture planned time, output and quality per equipment over a
-- period so Overall Equipment Effectiveness can be computed as
--   OEE = Availability × Performance × Quality
-- instead of the previous Availability-only approximation.
CREATE TABLE IF NOT EXISTS production_log (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    planned_minutes REAL NOT NULL DEFAULT 0,
    total_count REAL NOT NULL DEFAULT 0,
    good_count REAL NOT NULL DEFAULT 0,
    ideal_cycle_minutes REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_production_equipment ON production_log(equipment_id);
CREATE INDEX IF NOT EXISTS idx_production_period ON production_log(period_start, period_end);
