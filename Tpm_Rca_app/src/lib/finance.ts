// Financial Visibility (Roadmap #3)
//
// Pure helpers that turn downtime + per-asset cost data into the dollar
// figures managers care about: lost-production cost, hourly cost exposure,
// asset value at risk, and the downtime-cost-to-asset-value ratio.

export interface FinanceEquipment {
  id: string;
  tag_number: string | null;
  name: string | null;
  cost_per_hour: number | null;
  asset_value: number | null;
}

export interface FinanceDowntime {
  equipment_id: string;
  duration_minutes: number | null;
}

export interface AssetFinance {
  equipment_id: string;
  tag_number: string | null;
  name: string | null;
  downtime_minutes: number;
  downtime_cost: number;
  cost_per_hour: number | null;
  asset_value: number | null;
}

export interface FleetFinance {
  total_downtime_minutes: number;
  total_downtime_cost: number;
  total_hourly_cost: number;
  total_asset_value: number;
  /** Lost-production cost as a percentage of total asset value. */
  downtime_cost_ratio: number;
  assets: AssetFinance[];
  top_cost_assets: AssetFinance[];
}

/** Lost-production cost for a block of downtime at a given hourly rate. */
export function downtimeCost(minutes: number, costPerHour: number | null): number {
  if (!costPerHour || minutes <= 0) return 0;
  return (minutes / 60) * costPerHour;
}

export function computeFleetFinance(
  downtimes: FinanceDowntime[],
  equipment: FinanceEquipment[]
): FleetFinance {
  const byEq = new Map<string, number>();
  for (const d of downtimes) {
    const mins = d.duration_minutes || 0;
    byEq.set(d.equipment_id, (byEq.get(d.equipment_id) || 0) + mins);
  }

  const assets: AssetFinance[] = equipment.map((eq) => {
    const mins = byEq.get(eq.id) || 0;
    return {
      equipment_id: eq.id,
      tag_number: eq.tag_number,
      name: eq.name,
      downtime_minutes: mins,
      downtime_cost: downtimeCost(mins, eq.cost_per_hour),
      cost_per_hour: eq.cost_per_hour,
      asset_value: eq.asset_value,
    };
  });

  const totalDowntimeMinutes = assets.reduce((a, x) => a + x.downtime_minutes, 0);
  const totalDowntimeCost = assets.reduce((a, x) => a + x.downtime_cost, 0);
  const totalHourlyCost = equipment.reduce((a, x) => a + (x.cost_per_hour || 0), 0);
  const totalAssetValue = equipment.reduce((a, x) => a + (x.asset_value || 0), 0);
  const downtimeCostRatio =
    totalAssetValue > 0 ? (totalDowntimeCost / totalAssetValue) * 100 : 0;

  const topCostAssets = [...assets]
    .filter((a) => a.downtime_cost > 0)
    .sort((a, b) => b.downtime_cost - a.downtime_cost)
    .slice(0, 6);

  return {
    total_downtime_minutes: totalDowntimeMinutes,
    total_downtime_cost: totalDowntimeCost,
    total_hourly_cost: totalHourlyCost,
    total_asset_value: totalAssetValue,
    downtime_cost_ratio: downtimeCostRatio,
    assets,
    top_cost_assets: topCostAssets,
  };
}

const currencyFmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFmt.format(value || 0);
}
