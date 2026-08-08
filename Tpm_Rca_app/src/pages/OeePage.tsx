import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Gauge, Package, Trash2, Plus, BarChart3 } from "lucide-react";
import { Button, Card, Field, Input, Select, StatCard, TableCard, PageHeader, LoadingState } from "../components/ui";
import { useToast } from "../context/ToastContext";
import type { ProductionLog, OeeMetrics, EquipmentOee, Equipment } from "../lib/oee";

function label(e: Equipment): string {
  return e.tag_number ? `${e.tag_number} — ${e.name || ""}`.trim() : (e.name || e.id);
}

const EMPTY_FORM = {
  equipment_id: "",
  period_start: "",
  period_end: "",
  planned_minutes: "",
  total_count: "",
  good_count: "",
  ideal_cycle_minutes: "",
};

export default function OeePage() {
  const toast = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [fleet, setFleet] = useState<OeeMetrics | null>(null);
  const [perAsset, setPerAsset] = useState<Record<string, EquipmentOee>>({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const eq = await invoke<Equipment[]>("get_all_equipment");
      setEquipment(eq);
      const l = await invoke<ProductionLog[]>("list_production_logs", { equipmentId: null });
      setLogs(l);
      const m = await invoke<OeeMetrics>("get_oee_metrics");
      setFleet(m);
      const oeeMap: Record<string, EquipmentOee> = {};
      for (const e of eq) {
        try {
          const o = await invoke<EquipmentOee>("get_equipment_oee", { equipmentId: e.id });
          oeeMap[e.id] = o;
        } catch {
          /* ignore per-asset errors */
        }
      }
      setPerAsset(oeeMap);
    } catch (err) {
      toast.error("Failed to load OEE data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipment_id) {
      toast.error("Select an equipment");
      return;
    }
    const planned = parseFloat(form.planned_minutes);
    const total = parseFloat(form.total_count);
    const good = parseFloat(form.good_count);
    const ideal = parseFloat(form.ideal_cycle_minutes);
    if (![planned, total, good, ideal].every((n) => Number.isFinite(n))) {
      toast.error("Planned time, counts and ideal cycle time are required");
      return;
    }
    setSaving(true);
    try {
      await invoke("create_production_log", {
        payload: {
          equipmentId: form.equipment_id,
          periodStart: form.period_start || null,
          periodEnd: form.period_end || null,
          plannedMinutes: planned,
          totalCount: total,
          goodCount: good,
          idealCycleMinutes: ideal,
        },
      });
      toast.success("Production log saved");
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error("Could not save production log");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await invoke("delete_production_log", { id });
      toast.success("Production log deleted");
      await load();
    } catch (err) {
      toast.error("Could not delete log");
      console.error(err);
    }
  }

  if (loading) return <LoadingState label="Calculating OEE…" />;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Production & OEE"
        subtitle="Overall Equipment Effectiveness = Availability × Performance × Quality"
      />

      {fleet && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Gauge className="w-5 h-5 text-blue-600" />}
            tint="blue"
            label="Overall OEE"
            value={<span className="text-blue-700">{fleet.oee}%</span>}
            sub={fleet.has_production_data ? "from production logs" : "availability only (no logs yet)"}
          />
          <StatCard
            icon={<Gauge className="w-5 h-5 text-emerald-600" />}
            tint="emerald"
            label="Availability"
            value={<span className="text-emerald-700">{fleet.availability}%</span>}
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5 text-amber-600" />}
            tint="amber"
            label="Performance"
            value={<span className="text-amber-700">{fleet.performance}%</span>}
          />
          <StatCard
            icon={<Package className="w-5 h-5 text-violet-600" />}
            tint="violet"
            label="Quality"
            value={<span className="text-violet-700">{fleet.quality}%</span>}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Log a production run
          </h3>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Equipment">
              <Select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                required
              >
                <option value="">Select equipment…</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {label(e)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period start">
                <Input
                  type="datetime-local"
                  value={form.period_start}
                  onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                />
              </Field>
              <Field label="Period end">
                <Input
                  type="datetime-local"
                  value={form.period_end}
                  onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Planned production time (min)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.planned_minutes}
                onChange={(e) => setForm({ ...form, planned_minutes: e.target.value })}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total units">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.total_count}
                  onChange={(e) => setForm({ ...form, total_count: e.target.value })}
                  required
                />
              </Field>
              <Field label="Good units">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.good_count}
                  onChange={(e) => setForm({ ...form, good_count: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Ideal cycle time (min / unit)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.ideal_cycle_minutes}
                onChange={(e) => setForm({ ...form, ideal_cycle_minutes: e.target.value })}
                required
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save production log"}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Per-equipment OEE</h3>
          {Object.keys(perAsset).length === 0 ? (
            <p className="text-sm text-slate-400">No equipment found.</p>
          ) : (
            <TableCard>
              <table className="w-full text-sm">
                <thead className={undefined}>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-4 text-left font-medium">Asset</th>
                    <th className="p-4 text-left font-medium">Availability</th>
                    <th className="p-4 text-left font-medium">Performance</th>
                    <th className="p-4 text-left font-medium">Quality</th>
                    <th className="p-4 text-left font-medium">OEE</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((e) => {
                    const o = perAsset[e.id];
                    return (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-800">{label(e)}</td>
                        <td className="p-4 text-slate-600">{o ? `${o.availability}%` : "—"}</td>
                        <td className="p-4 text-slate-600">{o ? `${o.performance}%` : "—"}</td>
                        <td className="p-4 text-slate-600">{o ? `${o.quality}%` : "—"}</td>
                        <td className="p-4 font-semibold text-slate-800">{o ? `${o.oee}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableCard>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-800 mb-4">Production logs</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">
            No production logs yet. Add one to start computing real OEE.
          </p>
        ) : (
          <TableCard>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-4 text-left font-medium">Asset</th>
                  <th className="p-4 text-left font-medium">Period</th>
                  <th className="p-4 text-left font-medium">Planned (min)</th>
                  <th className="p-4 text-left font-medium">Total</th>
                  <th className="p-4 text-left font-medium">Good</th>
                  <th className="p-4 text-left font-medium">Ideal/min</th>
                  <th className="p-4 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const e = equipment.find((x) => x.id === l.equipment_id);
                  return (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-800">
                        {e ? label(e) : l.equipment_id}
                      </td>
                      <td className="p-4 text-slate-600">
                        {l.period_start || "?"} → {l.period_end || "?"}
                      </td>
                      <td className="p-4 text-slate-600">{Math.round(l.planned_minutes)}</td>
                      <td className="p-4 text-slate-600">{Math.round(l.total_count)}</td>
                      <td className="p-4 text-slate-600">{Math.round(l.good_count)}</td>
                      <td className="p-4 text-slate-600">{l.ideal_cycle_minutes}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => remove(l.id)}
                          className="text-rose-600 hover:text-rose-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableCard>
        )}
      </Card>
    </div>
  );
}
