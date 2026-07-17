export interface ConditionRule {
  id: string;
  equipment_id: string | null;
  name: string;
  min_mtbf_minutes: number | null;
  min_rul_minutes: number | null;
  max_failure_count: number | null;
  max_downtime_minutes: number | null;
  max_avg_mttr_minutes: number | null;
  created_at: string | null;
}

export interface CbmTrigger {
  equipment_id: string;
  tag_number: string | null;
  name: string | null;
  severity: string;
  reasons: string[];
  mtbf: number;
  mttr: number;
  failure_count: number;
  rul: number | null;
  total_downtime_min: number;
}
