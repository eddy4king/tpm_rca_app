export interface ProductionLog {
  id: string;
  equipment_id: string;
  period_start: string | null;
  period_end: string | null;
  planned_minutes: number;
  total_count: number;
  good_count: number;
  ideal_cycle_minutes: number;
  created_at: string | null;
}

export interface OeeMetrics {
  has_production_data: boolean;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  planned_minutes?: number;
  downtime_minutes?: number;
  run_time_minutes?: number;
  total_count?: number;
  good_count?: number;
}

export interface EquipmentOee {
  equipment_id: string;
  has_data: boolean;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  planned_minutes?: number;
  downtime_minutes?: number;
  run_time_minutes?: number;
  total_count?: number;
  good_count?: number;
}

export interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}
