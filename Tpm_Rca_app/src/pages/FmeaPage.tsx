import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  PageHeader,
  Card,
  Input,
  Select,
  Textarea,
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
import type { FmeaRow } from "../lib/reliability";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

function rpnTone(rpn: number): string {
  if (rpn >= 200) return "bg-rose-100 text-rose-700 border border-rose-200";
  if (rpn >= 100) return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-emerald-100 text-emerald-700 border border-emerald-200";
}

const emptyForm = {
  equipment_id: "",
  failure_mode: "",
  effect: "",
  cause: "",
  severity: 5,
  occurrence: 5,
  detection: 5,
  action: "",
  owner: "",
  status: "Open",
};

export default function FmeaPage() {
  const { canEdit } = useAuth();
  const canEditFmea = canEdit("Engineer");
  const [rows, setRows] = useState<FmeaRow[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const eqLabel = useMemo(
    () => (id: string) =>
      equipment.find((e) => e.id === id)?.tag_number ||
      equipment.find((e) => e.id === id)?.name ||
      id,
    [equipment]
  );

  async function load() {
    try {
      setLoading(true);
      const [f, eq] = await Promise.all([
        invoke<FmeaRow[]>("get_fmea", { equipmentId: null }),
        invoke<Equipment[]>("get_all_equipment"),
      ]);
      setRows(f);
      setEquipment(eq);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  async function handleSave() {
    try {
      if (editingId) {
        await invoke("update_fmea", {
          payload: {
            id: editingId,
            failureMode: form.failure_mode || null,
            effect: form.effect || null,
            cause: form.cause || null,
            severity: form.severity,
            occurrence: form.occurrence,
            detection: form.detection,
            action: form.action || null,
            owner: form.owner || null,
            status: form.status || null,
          },
        });
      } else {
        await invoke("create_fmea", {
          payload: {
            equipmentId: form.equipment_id,
            failureMode: form.failure_mode,
            effect: form.effect || null,
            cause: form.cause || null,
            severity: form.severity,
            occurrence: form.occurrence,
            detection: form.detection,
            action: form.action || null,
            owner: form.owner || null,
            status: form.status,
          },
        });
      }
      await load();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await invoke("delete_fmea", { id });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(String(err));
    }
  }

  function startEdit(r: FmeaRow) {
    setForm({
      equipment_id: r.equipment_id,
      failure_mode: r.failure_mode,
      effect: r.effect || "",
      cause: r.cause || "",
      severity: r.severity,
      occurrence: r.occurrence,
      detection: r.detection,
      action: r.action || "",
      owner: r.owner || "",
      status: r.status || "Open",
    });
    setEditingId(r.id);
    setShowForm(true);
  }

  if (loading) return <LoadingState label="Loading FMEA…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="FMEA Analysis"
        subtitle="Structured failure-mode & effects capture with RPN ranking"
        actions={
          canEditFmea ? (
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add FMEA
            </Button>
          ) : (
            <></>
          )
        }
      />

      <Card>
        {rows.length === 0 ? (
          <p className="text-center text-slate-400 py-12">
            No FMEA entries yet. Add failure modes to rank risk by RPN.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Asset</th>
                  <th className={thClass}>Failure Mode</th>
                  <th className={thClass}>Effect</th>
                  <th className={thClass}>S</th>
                  <th className={thClass}>O</th>
                  <th className={thClass}>D</th>
                  <th className={thClass}>RPN</th>
                  <th className={thClass}>Action</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={trClass}>
                    <td className={`${tdClass} font-mono`}>{eqLabel(r.equipment_id)}</td>
                    <td className={`${tdClass} font-medium text-slate-800 dark:text-slate-100`}>
                      {r.failure_mode}
                    </td>
                    <td className={`${tdClass} text-slate-600`}>{r.effect || "—"}</td>
                    <td className={tdClass}>{r.severity}</td>
                    <td className={tdClass}>{r.occurrence}</td>
                    <td className={tdClass}>{r.detection}</td>
                    <td className={tdClass}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rpnTone(r.rpn)}`}>
                        {r.rpn}
                      </span>
                    </td>
                    <td className={`${tdClass} text-slate-600`}>{r.action || "—"}</td>
                    <td className={tdClass}>{r.status || "Open"}</td>
                    <td className={tdClass}>
                      {canEditFmea ? (
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

      {showForm && canEditFmea && (
        <Modal title={editingId ? "Edit FMEA" : "Add FMEA"} onClose={() => setShowForm(false)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Equipment</label>
              <Select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                disabled={!!editingId}
              >
                <option value="">Select equipment…</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.tag_number} — {eq.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Failure Mode</label>
              <Input
                placeholder="e.g. Bearing seizure"
                value={form.failure_mode}
                onChange={(e) => setForm({ ...form, failure_mode: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Effect</label>
              <Textarea
                placeholder="Effect on product / process"
                value={form.effect}
                onChange={(e) => setForm({ ...form, effect: e.target.value })}
                className="h-20 resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Cause</label>
              <Input
                placeholder="Root cause mechanism"
                value={form.cause}
                onChange={(e) => setForm({ ...form, cause: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Severity (1-10)</label>
                <Select value={String(form.severity)} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Occurrence (1-10)</label>
                <Select value={String(form.occurrence)} onChange={(e) => setForm({ ...form, occurrence: Number(e.target.value) })}>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Detection (1-10)</label>
                <Select value={String(form.detection)} onChange={(e) => setForm({ ...form, detection: Number(e.target.value) })}>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Computed RPN:{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {form.severity * form.occurrence * form.detection}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Recommended Action</label>
              <Textarea
                placeholder="Recommended action / containment"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                className="h-20 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Owner</label>
                <Input
                  placeholder="Owner"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">Status</label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Closed</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingId ? "Update" : "Save"}</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete FMEA entry"
        message="Remove this failure-mode entry?"
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
