ALTER TABLE equipment ADD COLUMN area_id TEXT;
CREATE INDEX IF NOT EXISTS idx_equipment_area ON equipment(area_id);
