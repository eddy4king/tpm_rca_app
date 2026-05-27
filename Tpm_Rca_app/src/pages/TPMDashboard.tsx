import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity, Clock, Zap, AlertTriangle, BarChart2
} from "lucide-react";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

interface Downtime {
  id: string;
  equipment_id: string;
  title: string | null;
  loss_category: string | null;
  duration_minutes: number | null;
  start_time: string | null;
}

interface EquipmentMetrics {
  eq: Equipment;
  events: number;
  downtimeMins: number;
  availability: number;
  mttr: number;
  mtbf: number;
}

interface EquipmentRcaSummary {
  investigation_id: string | null;
  investigation_title: string | null;
  investigation_status: string | null;
  open_capas: number | null;
  in_progress_capas: number | null;
}

export default function TPMDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const prior = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(prior);
  const [endDate, setEndDate] = useState(today);
  const [plannedHrs, setPlannedHrs] = useState(16);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [metrics, setMetrics] = useState<EquipmentMetrics[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [rcaSummaries, setRcaSummaries] = useState<Record<string, EquipmentRcaSummary[]>>({});
  const [loadingRca, setLoadingRca] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<Equipment[]>("get_all_equipment").then(setEquipment).catch(console.error);
  }, []);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const downtime = await invoke<Downtime[]>("get_downtime_in_range", {
        startDate,
        endDate,
      });

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      const plannedMins = plannedHrs * 60 * days;

      const byEq: Record<string, Downtime[]> = {};
      downtime.forEach(d => {
        if (!byEq[d.equipment_id]) byEq[d.equipment_id] = [];
        byEq[d.equipment_id].push(d);
      });

      const eqMap: Record<string, Equipment> = {};
      equipment.forEach(e => { eqMap[e.id] = e; });

      equipment.forEach(e => { if (!byEq[e.id]) byEq[e.id] = []; });

      const rows: EquipmentMetrics[] = Object.entries(byEq).map(([eqId, events]) => {
        const eq = eqMap[eqId] || { id: eqId, name: eqId, tag_number: null };
        const dtMins = events.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
        const n = events.length;
        const availability = plannedMins > 0
          ? Math.max(0, Math.min(100, ((plannedMins - dtMins) / plannedMins) * 100))
          : 0;
        const mttr = n > 0 ? dtMins / n : 0;
        const uptime = Math.max(0, plannedMins - dtMins);
        const mtbf = n > 0 ? uptime / n : plannedMins;
        return { eq, events: n, downtimeMins: dtMins, availability, mttr, mtbf };
      });

      rows.sort((a, b) => a.availability - b.availability);

      const catMap: Record<string, number> = {};
      downtime.forEach(d => {
        const cat = d.loss_category || "Unknown";
        catMap[cat] = (catMap[cat] || 0) + (d.duration_minutes ?? 0);
      });

      setMetrics(rows);
      setCategoryMap(catMap);
      setCalculated(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleRcaSummary(eqId: string, availability: number) {
    if (availability >= 60) return;

    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(eqId)) { next.delete(eqId); return next; }
      next.add(eqId);
      return next;
    });

    if (rcaSummaries[eqId]) return;

    setLoadingRca(prev => new Set(prev).add(eqId));
    try {
      const data = await invoke<EquipmentRcaSummary[]>("get_equipment_rca_summary", {
        equipmentId: eqId,
      });
      setRcaSummaries(prev => ({ ...prev, [eqId]: data }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRca(prev => {
        const next = new Set(prev);
        next.delete(eqId);
        return next;
      });
    }
  }

  const totalDTHrs = metrics.reduce((s, r) => s + r.downtimeMins, 0) / 60;
  const totalEvents = metrics.reduce((s, r) => s + r.events, 0);
  const withEvents = metrics.filter(r => r.events > 0);
  const avgAvail = metrics.length
    ? metrics.reduce((s, r) => s + r.availability, 0) / metrics.length
    : 0;
  const avgMTTR = withEvents.length
    ? withEvents.reduce((s, r) => s + r.mttr, 0) / withEvents.length
    : 0;
  const avgMTBF = withEvents.length
    ? withEvents.reduce((s, r) => s + r.mtbf, 0) / withEvents.length
    : 0;

  function availBadge(a: number) {
    if (a >= 85) return "bg-emerald-100 text-emerald-700";
    if (a >= 60) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  }

  function availLabel(a: number) {
    if (a >= 85) return "Good";
    if (a >= 60) return "Watch";
    return "Critical";
  }

  function availBarColor(a: number) {
    if (a >= 85) return "bg-emerald-500";
    if (a >= 60) return "bg-amber-500";
    return "bg-red-500";
  }

  return (
    <div className="flex flex-col bg-slate-100 text-slate-800" style={{ height: "calc(100vh - 80px)" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">TPM Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500">OEE · MTTR · MTBF — calculated from downtime logs</p>

        {/* CONTROLS */}
        <div className="flex flex-wrap gap-4 mt-5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-2.5 bg-white text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-2.5 bg-white text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">
              Planned hrs/day{" "}
              <span className="text-slate-400">(e.g. 16 = 2 shifts × 8 hrs)</span>
            </label>
            <input
              type="number"
              value={plannedHrs}
              min={1}
              max={24}
              onChange={e => setPlannedHrs(Number(e.target.value))}
              className="border border-slate-300 rounded-xl px-4 py-2.5 bg-white text-sm w-32"
            />
          </div>
          <button
            onClick={calculate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-medium text-sm"
          >
            {loading ? "Calculating..." : "Calculate"}
          </button>
        </div>

        {/* SUMMARY CARDS */}
        {calculated && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
            {[
              { label: "Fleet availability", value: avgAvail.toFixed(1) + "%", icon: Activity, color: "text-blue-600" },
              { label: "Total downtime", value: totalDTHrs.toFixed(1) + " hrs", icon: AlertTriangle, color: "text-red-500" },
              { label: "Avg MTTR", value: (avgMTTR / 60).toFixed(2) + " hrs", icon: Clock, color: "text-amber-500" },
              { label: "Avg MTBF", value: (avgMTBF / 60).toFixed(1) + " hrs", icon: Zap, color: "text-emerald-500" },
              { label: "Total events", value: totalEvents.toString(), icon: BarChart2, color: "text-slate-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className={`flex items-center gap-1.5 text-xs ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </div>
                <p className="text-2xl font-bold mt-2 text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <div className="text-red-500 text-sm">{error}</div>}

        {!calculated && !loading && (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-400">No data yet</h2>
              <p className="text-sm text-slate-500 mt-2">
                Set the date range and planned hours, then click Calculate.
              </p>
            </div>
          </div>
        )}

        {/* PER-EQUIPMENT TABLE */}
        {calculated && metrics.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Per-equipment breakdown</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sorted by availability (worst first) · Click a Critical row to see open RCAs and CAPAs
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 bg-slate-50">
                    <th className="text-left px-6 py-3 font-medium">Equipment</th>
                    <th className="text-right px-4 py-3 font-medium">Events</th>
                    <th className="text-right px-4 py-3 font-medium">Downtime</th>
                    <th className="text-right px-4 py-3 font-medium">MTTR</th>
                    <th className="text-right px-4 py-3 font-medium">MTBF</th>
                    <th className="px-4 py-3 font-medium" style={{ minWidth: 160 }}>Availability</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((r, i) => {
                    const isCritical = r.availability < 60;
                    const isExpanded = expandedRows.has(r.eq.id);
                    const summaries = rcaSummaries[r.eq.id] || [];
                    const isLoadingThis = loadingRca.has(r.eq.id);
                    const openCapas = (s: EquipmentRcaSummary) => s.open_capas ?? 0;
                    const inProgressCapas = (s: EquipmentRcaSummary) => s.in_progress_capas ?? 0;

                    return (
                      <>
                        <tr
                          key={r.eq.id}
                          className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${isCritical ? "cursor-pointer hover:bg-red-50/40" : ""}`}
                          onClick={() => toggleRcaSummary(r.eq.id, r.availability)}
                        >
                          <td className="px-6 py-4 font-medium">
                            <div className="flex items-center gap-2">
                              {isCritical && (
                                <span className="text-red-400 text-xs">
                                  {isExpanded ? "▾" : "▸"}
                                </span>
                              )}
                              {r.eq.tag_number ? `${r.eq.tag_number} — ` : ""}
                              {r.eq.name || r.eq.id}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">{r.events}</td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {(r.downtimeMins / 60).toFixed(1)} hrs
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {r.events > 0 ? (r.mttr / 60).toFixed(2) + " hrs" : "—"}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {r.events > 0 ? (r.mtbf / 60).toFixed(1) + " hrs" : "—"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full ${availBarColor(r.availability)}`}
                                  style={{ width: `${r.availability.toFixed(1)}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 min-w-[38px] text-right">
                                {r.availability.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${availBadge(r.availability)}`}>
                              {availLabel(r.availability)}
                            </span>
                          </td>
                        </tr>

                        {/* EXPANDED RCA/CAPA PANEL */}
                        {isCritical && isExpanded && (
                          <tr key={`${r.eq.id}-detail`} className="bg-red-50/30">
                            <td colSpan={7} className="px-8 pb-4 pt-2">
                              {isLoadingThis ? (
                                <p className="text-xs text-slate-400 py-2">Loading investigations...</p>
                              ) : summaries.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">
                                  No open RCA investigations for this equipment.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-red-600 mb-2 uppercase tracking-wide">
                                    Open investigations
                                  </p>
                                  {summaries.map(s => (
                                    <div
                                      key={s.investigation_id}
                                      className="flex items-center justify-between bg-white border border-red-100 rounded-xl px-4 py-3"
                                    >
                                      <div>
                                        <p className="text-sm font-medium text-slate-700">
                                          {s.investigation_title || "Untitled investigation"}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                          Status: {s.investigation_status}
                                        </p>
                                      </div>
                                      <div className="flex gap-3 text-xs">
                                        {openCapas(s) > 0 && (
                                          <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
                                            {openCapas(s)} open CAPA{openCapas(s) > 1 ? "s" : ""}
                                          </span>
                                        )}
                                        {inProgressCapas(s) > 0 && (
                                          <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                                            {inProgressCapas(s)} in progress
                                          </span>
                                        )}
                                        {openCapas(s) === 0 && inProgressCapas(s) === 0 && (
                                          <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">
                                            No open CAPAs
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOSS CATEGORY BREAKDOWN */}
        {calculated && Object.keys(categoryMap).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="font-bold text-slate-700 mb-4">Downtime by loss category</h2>
            <div className="space-y-3">
              {Object.entries(categoryMap)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, mins]) => {
                  const maxMins = Math.max(...Object.values(categoryMap));
                  const pct = maxMins > 0 ? (mins / maxMins) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-4">
                      <span className="text-sm text-slate-600 w-40 truncate">{cat}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-blue-500"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-500 w-20 text-right">
                        {(mins / 60).toFixed(1)} hrs
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}