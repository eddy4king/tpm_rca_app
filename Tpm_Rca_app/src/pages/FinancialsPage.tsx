import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DollarSign, Download, Search, TrendingDown, Wallet, PiggyBank, BarChart3,
} from "lucide-react";
import {
  PageHeader, Card, Input, Button, LoadingState, Banner, StatCard,
  tableHeadClass, thClass, tdClass, trClass,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import {
  computeFleetFinance, formatCurrency, FinanceEquipment, FinanceDowntime,
} from "../lib/finance";
import { exportToCsv } from "../lib/export";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
  cost_per_hour: number | null;
  asset_value: number | null;
}

interface Downtime {
  equipment_id: string;
  duration_minutes: number | null;
}

export default function FinancialsPage() {
  const toast = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [downtime, setDowntime] = useState<Downtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [eq, dt] = await Promise.all([
          invoke<Equipment[]>("get_all_equipment"),
          invoke<Downtime[]>("get_all_downtime"),
        ]);
        setEquipment(eq);
        setDowntime(dt);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finance = useMemo(() => {
    const finEq: FinanceEquipment[] = equipment.map((e) => ({
      id: e.id,
      tag_number: e.tag_number,
      name: e.name,
      cost_per_hour: e.cost_per_hour,
      asset_value: e.asset_value,
    }));
    const finDt: FinanceDowntime[] = downtime.map((d) => ({
      equipment_id: d.equipment_id,
      duration_minutes: d.duration_minutes,
    }));
    return computeFleetFinance(finDt, finEq);
  }, [equipment, downtime]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...finance.assets]
      .filter(
        (a) =>
          !q ||
          `${a.tag_number || ""} ${a.name || ""}`.toLowerCase().includes(q)
      )
      .sort((a, b) => b.downtime_cost - a.downtime_cost);
  }, [finance.assets, search]);

  const valuedCount = useMemo(
    () => equipment.filter((e) => e.cost_per_hour != null).length,
    [equipment]
  );

  if (loading) return <LoadingState label="Loading financials…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const maxBar = Math.max(...finance.top_cost_assets.map((a) => a.downtime_cost), 1);

  return (
    <div className="bg-slate-50 text-slate-800 overflow-y-auto" style={{ height: "100%" }}>
      <div className="px-6 py-5">
        <PageHeader
          title="Financial Visibility"
          subtitle="Turn downtime into dollars — lost production, asset exposure & ROI"
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                exportToCsv("financial_report", finance.assets, [
                  { key: "tag_number", label: "Tag Number" },
                  { key: "name", label: "Name" },
                  { key: "downtime_minutes", label: "Downtime (min)" },
                  { key: "downtime_cost", label: "Downtime Cost", format: (v) => formatCurrency(v as number) },
                  { key: "cost_per_hour", label: "Cost/Hour", format: (v) => (v as number | null) ?? "" },
                  { key: "asset_value", label: "Asset Value", format: (v) => (v as number | null) ?? "" },
                ]);
                toast.success("Financial report exported");
              }}
            >
              <Download className="w-4 h-4" /> Export Report
            </Button>
          }
        />

        {/* KPI ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <StatCard
            tint="rose"
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Downtime Cost"
            value={<span className="text-rose-700">{formatCurrency(finance.total_downtime_cost)}</span>}
            sub="Lost production (logged)"
          />
          <StatCard
            tint="emerald"
            icon={<Wallet className="w-5 h-5" />}
            label="Total Asset Value"
            value={<span className="text-emerald-700">{formatCurrency(finance.total_asset_value)}</span>}
            sub="Tracked replacement value"
          />
          <StatCard
            tint="amber"
            icon={<PiggyBank className="w-5 h-5" />}
            label="Hourly Cost Exposure"
            value={<span className="text-amber-700">{formatCurrency(finance.total_hourly_cost)}</span>}
            sub="If all assets down at once"
          />
          <StatCard
            tint="orange"
            icon={<TrendingDown className="w-5 h-5" />}
            label="Cost vs Asset Value"
            value={<span className="text-orange-700">{finance.downtime_cost_ratio.toFixed(1)}%</span>}
            sub="Lost production ÷ asset value"
          />
        </div>

        {valuedCount === 0 && (
          <Banner tone="info" className="mt-5">
            No equipment has a <strong>Cost / Hour</strong> set yet. Add it on the
            Equipment page to quantify downtime losses here.
          </Banner>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* TOP COST ASSETS */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">Top Cost Assets (downtime $)</h3>
            </div>
            {finance.top_cost_assets.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No valued downtime yet — set a Cost / Hour on equipment to quantify losses.
              </p>
            ) : (
              <div className="space-y-3">
                {finance.top_cost_assets.map((a) => (
                  <div key={a.equipment_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">
                        {a.tag_number || a.name || a.equipment_id}
                      </span>
                      <span className="font-semibold text-rose-600">
                        {formatCurrency(a.downtime_cost)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${(a.downtime_cost / maxBar) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* SUMMARY */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">Financial Summary</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Total logged downtime</span>
                <span className="font-semibold text-slate-800">
                  {finance.total_downtime_minutes.toLocaleString()} min
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Assets with cost rate</span>
                <span className="font-semibold text-slate-800">
                  {valuedCount} / {equipment.length}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Downtime cost</span>
                <span className="font-semibold text-rose-600">
                  {formatCurrency(finance.total_downtime_cost)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Asset value at risk</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(finance.total_asset_value)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lost production ratio</span>
                <span className="font-semibold text-orange-600">
                  {finance.downtime_cost_ratio.toFixed(1)}%
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* ASSET TABLE */}
        <Card className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="font-bold text-slate-800">Per-Asset Financials</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No assets match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={thClass}>Tag</th>
                    <th className={thClass}>Asset</th>
                    <th className={thClass}>Downtime (min)</th>
                    <th className={thClass}>Downtime Cost</th>
                    <th className={thClass}>Cost / Hour</th>
                    <th className={thClass}>Asset Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.equipment_id} className={trClass}>
                      <td className={`${tdClass} font-mono`}>{a.tag_number || "—"}</td>
                      <td className={`${tdClass} font-medium text-slate-800`}>{a.name || "—"}</td>
                      <td className={tdClass}>{a.downtime_minutes.toLocaleString()}</td>
                      <td className={`${tdClass} font-semibold text-rose-600`}>
                        {formatCurrency(a.downtime_cost)}
                      </td>
                      <td className={tdClass}>
                        {a.cost_per_hour != null ? formatCurrency(a.cost_per_hour) : "—"}
                      </td>
                      <td className={tdClass}>
                        {a.asset_value != null ? formatCurrency(a.asset_value) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
