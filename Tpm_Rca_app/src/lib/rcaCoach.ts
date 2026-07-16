export interface CoachCategory {
  category: string;
  count: number;
  minutes: number;
}

export interface CoachRecurring {
  signature: string;
  count: number;
  example: string;
}

export interface CoachAction {
  title: string;
  description: string;
}

export interface CoachSeed {
  problem: string;
  causes: string[];
  actions: string[];
}

export interface CoachStats {
  downtime_count: number;
  total_minutes: number;
  avg_mttr: number;
  recurring_count: number;
  open_investigations: number;
}

export interface RcaCoachReport {
  equipment_id: string;
  equipment_name: string | null;
  stats: CoachStats;
  top_loss_categories: CoachCategory[];
  recurring_failures: CoachRecurring[];
  suggested_failure_modes: string[];
  suggested_capa: CoachAction[];
  rca_seed: CoachSeed;
  has_history: boolean;
}
