import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, Gauge, BellRing, AlertTriangle } from "lucide-react";
import {
  PageHeader,
  Card,
  Input,
  Select,
  Button,
  Modal,
  ConfirmDialog,
  LoadingState,
  Banner,
  tableHeadClass,
  thClass,
  tdClass,
  trClass,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { ConditionRule, CbmTrigger } from "../lib/cbm";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

function severityTone(sev: string): string {
  if (sev === "High") return "bg-rose-100 text-rose-700 border border-rose-200";
  if (sev === "Medium") return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

const emptyForm = {
  id: "",
  equipment_id: "",
  name: "",
  min_mtbf_minutes: "" as string,
  min_rul_minutes: "" as string,
  max_failure_count: "" as string,
  max_downtime_minutes: "" as string,
  max_avg_mttr_minutes: "" as string,
};

export default function CbmPage() {
  const { canEdit } = useAuth();
  const canEditCbm = canEdit("Engineer");
  const [triggers, setTriggers] = useState<CbmTrigger[]>([]);
  const [rules, setRules] = useState<ConditionRule[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const parseNum = (v: string): number | null => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [t, r, eq] = await Promise.all([
        invoke<CbmTrigger[]>("cbm_triggers"),
        invoke<ConditionRule[]>("get_cbm_rules"),
        invoke<Equipment[]>("get_all_equipment"),
      ]);
      setTriggers(t);
      setRules(r);
      setEquipment(eq);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  async function handleSave() {
    try {
      await invoke("upsert_cbm_rule", {
        payload: {
          id: editingId || null,
          equipmentId: form.equipment_id || null,
          name: form.name,
          minMtbfMinutes: parseNum(form.min_mtbf_minutes),
          minRulMinutes: parseNum(form.min_rul_minutes),
          maxFailureCount: parseNum(form.max_failure_count),
          maxDowntimeMinutes: parseNum(form.max_downtime_minutes),
          maxAvgMttrMinutes: parseNum(form.max_avg_mttr_minutes),
        },
      });
      await load();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await invoke("delete_cbm_rule", { id });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(String(err));
    }
  }

  function startEdit(r: ConditionRule) {
    setForm({
      id: r.id,
      equipment_id: r.equipment_id || "",
      name: r.name,
      min_mtbf_minutes: r.min_mtbf_minutes?.toString() ?? "",
      min_rul_minutes: r.min_rul_minutes?.toString() ?? "",
      max_failure_count: r.max_failure_count?.toString() ?? "",
      max_downtime_minutes: r.max_downtime_minutes?.toString() ?? "",
      max_avg_mttr_minutes: r.max_avg_mttr_minutes?.toString() ?? "",
    });
    setEditingId(r.id);
    setShowForm(true);
  }

  const highCount = triggers.filter((t) => t.severity === "High").length;

  if (loading) return <LoadingState label="Loading condition monitoring…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Condition-Based Maintenance"
        subtitle="Trigger maintenance when reliability metrics breach equipment or fleet thresholds"
        live
        actions={
          canEditCbm ? (
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4" /> Add Rule
            </Button>
          ) : null
        }
      />

      {/* TRIGGERS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500">Active triggers</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900">{triggers.length}</h3>
            </div>
            <BellRing className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500">High severity</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-600">{highCount}</h3>
            </div>
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500">Rules defined</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900">{rules.length}</h3>
            </div>
            <Gauge className="w-8 h-8 text-emerald-500" />
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 px-4 pt-4">
          Active CBM Triggers
        </h3>
        {triggers.length === 0 ? (
          <p className="text-center text-slate-400 py-10">
            No triggered conditions. Define a rule (e.g. a fleet default) to start monitoring.
          </p>
        ) : (
          <div className="p-4 grid md:grid-cols-2 gap-4">
            {triggers.map((t) => (
              <div
                key={t.equipment_id}
                className="rounded-2xl border border-slate-200 p-4 bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {t.tag_number || t.name || t.equipment_id}
                  </p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${severityTone(t.severity)}`}>
                    {t.severity}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  MTBF {Math.round(t.mtbf)}m · MTTR {Math.round(t.mttr)}m ·{" "}
                  {t.failure_count} failures · {t.total_downtime_min}m downtime
                  {t.rul !== null ? ` · RUL ${Math.round(t.rul)}m` : ""}
                </div>
                <ul className="space-y-1.5">
                  {t.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* RULES */}
      <Card>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 px-4 pt-4">
          Monitoring Rules
        </h3>
        {rules.length === 0 ? (
          <p className="text-center text-slate-400 py-10">
            No rules yet. Add a fleet-default rule to monitor every asset.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Scope</th>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Min MTBF</th>
                  <th className={thClass}>Min RUL</th>
                  <th className={thClass}>Max Failures</th>
                  <th className={thClass}>Max Downtime</th>
                  <th className={thClass}>Max MTTR</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className={trClass}>
                    <td className={`${tdClass} font-medium text-slate-800 dark:text-slate-100`}>
                      {r.equipment_id
                        ? equipment.find((e) => e.id === r.equipment_id)?.tag_number ||
                          r.equipment_id
                        : "Fleet default"}
                    </td>
                    <td className={tdClass}>{r.name}</td>
                    <td className={tdClass}>{r.min_mtbf_minutes ? `${r.min_mtbf_minutes}m` : "—"}</td>
                    <td className={tdClass}>{r.min_rul_minutes ? `${r.min_rul_minutes}m` : "—"}</td>
                    <td className={tdClass}>{r.max_failure_count ?? "—"}</td>
                    <td className={tdClass}>{r.max_downtime_minutes ? `${r.max_downtime_minutes}m` : "—"}</td>
                    <td className={tdClass}>{r.max_avg_mttr_minutes ? `${r.max_avg_mttr_minutes}m` : "—"}</td>
                    <td className={tdClass}>
                      {canEditCbm ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="edit" onClick={() => startEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && canEditCbm && (
        <Modal
          title={editingId ? "Edit Rule" : "Add Rule"}
          onClose={() => setShowForm(false)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                Scope
              </label>
              <Select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
              >
                <option value="">Fleet default (all assets)</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.tag_number} — {eq.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                Rule name
              </label>
              <Input
                placeholder="e.g. Critical pump watch"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                  Min MTBF (min)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 4320"
                  value={form.min_mtbf_minutes}
                  onChange={(e) => setForm({ ...form, min_mtbf_minutes: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                  Min RUL (min)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 10080"
                  value={form.min_rul_minutes}
                  onChange={(e) => setForm({ ...form, min_rul_minutes: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                  Max failures
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 6"
                  value={form.max_failure_count}
                  onChange={(e) => setForm({ ...form, max_failure_count: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                  Max downtime (min)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 600"
                  value={form.max_downtime_minutes}
                  onChange={(e) => setForm({ ...form, max_downtime_minutes: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                  Max avg MTTR (min)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 240"
                  value={form.max_avg_mttr_minutes}
                  onChange={(e) => setForm({ ...form, max_avg_mttr_minutes: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Leave a field blank to disable that check. Equipment-specific rules override the
              fleet default.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>{editingId ? "Update" : "Save"}</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete rule"
        message="Remove this monitoring rule?"
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
