export interface CategoryCount {
  category: string;
  count: number;
  minutes: number;
}

export interface WeibullFit {
  beta: number;
  eta: number;
  rul: number | null;
  intervals: number;
}

export interface AssetReliability {
  equipment_id: string;
  tag_number: string | null;
  name: string | null;
  mttr: number;
  mtbf: number;
  failure_count: number;
  total_downtime_min: number;
  weibull: WeibullFit | null;
}

export interface ReliabilityReport {
  scope: string;
  equipment_name: string | null;
  mttr: number;
  mtbf: number;
  failure_count: number;
  total_downtime_min: number;
  availability_pct: number;
  pareto: CategoryCount[];
  weibull: WeibullFit | null;
  worst_assets: AssetReliability[];
}

export interface FmeaRow {
  id: string;
  equipment_id: string;
  failure_mode: string;
  effect: string | null;
  cause: string | null;
  severity: number;
  occurrence: number;
  detection: number;
  rpn: number;
  action: string | null;
  owner: string | null;
  status: string | null;
  created_at: string | null;
}
