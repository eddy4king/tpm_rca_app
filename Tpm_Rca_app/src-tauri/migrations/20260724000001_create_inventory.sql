CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY,
    part_number TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT,
    qty_on_hand REAL NOT NULL DEFAULT 0,
    reorder_level REAL NOT NULL DEFAULT 0,
    reorder_qty REAL NOT NULL DEFAULT 0,
    unit_cost REAL,
    location TEXT,
    supplier_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_part ON inventory_items(part_number);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier ON inventory_items(supplier_id);

CREATE TABLE inventory_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    txn_type TEXT NOT NULL,
    qty REAL NOT NULL,
    wo_id TEXT,
    user_id TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_item ON inventory_transactions(item_id);
