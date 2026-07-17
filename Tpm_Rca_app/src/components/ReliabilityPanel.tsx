import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Activity, TrendingDown, TrendingUp, Gauge } from "lucide-react";
import { Card, StatCard } from "./ui";
import type { ReliabilityReport, AssetReliability } from "../lib/reliability";

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function RulBadge({ a }: { a: AssetReliability }) {
  const rul = a.weibull?.rul;
  if (rul === undefined || rul === null) {
    return <span className="text-xs text-slate-400">RUL n/a</span>;
  }
  const tone =
    rul < 24 * 7
      ? "bg-rose-100 text-rose-700"
      : rul < 24 * 30
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${tone}`}>RUL {fmt(rul)}m</span>;
}

export default function ReliabilityPanel() {
  const [report, setReport] = useState<ReliabilityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await invoke<ReliabilityReport>("reliability_report", { equipmentId: null });
        if (alive) setReport(r);
      } catch (err) {
        console.error(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <Card className="!p-6 text-sm text-slate-400">Analyzing reliability…</Card>;
  }
  if (!report) return null;

  const maxCat = Math.max(1, ...report.pareto.map((c) => c.count));
  const beta = report.weibull?.beta;
  const eta = report.weibull?.eta;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5 text-emerald-600" />}
          tint="emerald"
          label="Fleet MTBF (min)"
          value={<span className="text-emerald-600">{fmt(report.mtbf)}</span>}
        />
        <StatCard
          icon={<TrendingDown className="w-5 h-5 text-rose-600" />}
          tint="rose"
          label="Fleet MTTR (min)"
          value={<span className="text-rose-600">{fmt(report.mttr)}</span>}
        />
        <StatCard
          icon={<Gauge className="w-5 h-5 text-blue-600" />}
          tint="slate"
          label="Availability"
          value={<span className="text-slate-900">{report.availability_pct.toFixed(1)}%</span>}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
          tint="amber"
          label="Failures"
          value={<span className="text-slate-900">{fmt(report.failure_count)}</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Loss-category Pareto
          </h3>
          {report.pareto.length === 0 ? (
            <p className="text-sm text-slate-400">No downtime recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {report.pareto.map((c) => (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 dark:text-slate-200">{c.category}</span>
                    <span className="text-slate-400">
                      {c.count}× · {fmt(c.minutes)}m
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Weibull fit</h3>
          {beta !== undefined && eta !== undefined ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Shape β</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{beta.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scale η (min)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{fmt(eta)}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">
                {beta < 1
                  ? "Infant-mortality / wear-in region — early failures dominate."
                  : beta > 3
                  ? "Wear-out region — failures concentrate near end of life."
                  : "Random / mixed failure pattern (β ≈ 1)."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Need at least 2 failure intervals to fit a Weibull curve.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
          Worst-asset ranking (lowest MTBF first)
        </h3>
        {report.worst_assets.length === 0 ? (
          <p className="text-sm text-slate-400">No failure history to rank.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Asset</th>
                  <th className="py-2 pr-4">MTBF</th>
                  <th className="py-2 pr-4">MTTR</th>
                  <th className="py-2 pr-4">Failures</th>
                  <th className="py-2">Weibull β / RUL</th>
                </tr>
              </thead>
              <tbody>
                {report.worst_assets.map((a) => (
                  <tr key={a.equipment_id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {a.tag_number}
                      </p>
                      <p className="text-xs text-slate-400">{a.name}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{fmt(a.mtbf)}m</td>
                    <td className="py-2.5 pr-4 text-slate-600">{fmt(a.mttr)}m</td>
                    <td className="py-2.5 pr-4 text-slate-600">{a.failure_count}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">
                          β {a.weibull ? a.weibull.beta.toFixed(1) : "—"}
                        </span>
                        <RulBadge a={a} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
