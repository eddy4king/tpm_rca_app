CREATE TABLE work_orders (
    id TEXT PRIMARY KEY,
    wo_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    equipment_id TEXT,
    wo_type TEXT NOT NULL DEFAULT 'corrective',
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    requested_by TEXT,
    assigned_to TEXT,
    planned_start TEXT,
    due_date TEXT,
    completed_at TEXT,
    approval_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wo_number ON work_orders(wo_number);
CREATE INDEX IF NOT EXISTS idx_wo_equipment ON work_orders(equipment_id);
CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);

CREATE TABLE wo_labor (
    id TEXT PRIMARY KEY,
    wo_id TEXT NOT NULL,
    person_name TEXT,
    minutes REAL NOT NULL DEFAULT 0,
    rate REAL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wo_labor_wo ON wo_labor(wo_id);

CREATE TABLE wo_parts (
    id TEXT PRIMARY KEY,
    wo_id TEXT NOT NULL,
    item_id TEXT,
    part_number TEXT,
    qty REAL NOT NULL DEFAULT 0,
    unit_cost REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_wo_parts_wo ON wo_parts(wo_id);
