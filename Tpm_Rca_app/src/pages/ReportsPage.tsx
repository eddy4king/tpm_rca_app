import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Card, Input, Select, Button, LoadingState, Banner, Field, Modal, TableCard, tableHeadClass, thClass, tdClass, trClass } from "../components/ui";
import { FileBarChart, Plus, Play, Trash2 } from "lucide-react";

interface ReportSchedule {
  id: string;
  name: string;
  dataset: string;
  format: string;
  frequency: string;
  recipients: string | null;
  last_run: string | null;
  created_at: string | null;
}

const DATASETS = ["workorders", "timesheets", "inventory", "audit"];
const FREQS = ["daily", "weekly", "monthly"];

export default function ReportsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const canManage = canEdit("Engineer");

  const [reports, setReports] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", dataset: "workorders", format: "csv", frequency: "weekly", recipients: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setReports(await invoke<ReportSchedule[]>("get_report_schedules"));
      setError(null);
    } catch (err) { setError(String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name) { toast.error("Name is required"); return; }
    try {
      await invoke("create_report_schedule", {
        payload: {
          name: form.name, dataset: form.dataset, format: form.format,
          frequency: form.frequency, recipients: form.recipients || null,
        },
      });
      toast.success("Report schedule created");
      setShowForm(false);
      setForm({ name: "", dataset: "workorders", format: "csv", frequency: "weekly", recipients: "" });
      load();
    } catch (err) { toast.error(`Failed: ${err}`); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this report schedule?")) return;
    try { await invoke("delete_report_schedule", { id }); setReports((p) => p.filter((r) => r.id !== id)); toast.success("Deleted"); }
    catch (err) { toast.error(`Failed: ${err}`); }
  }

  async function handleRun(r: ReportSchedule) {
    try {
      const path = await invoke<string>("run_report_schedule", { id: r.id });
      toast.success(`Report generated: ${path}`);
    } catch (err) { toast.error(`Failed: ${err}`); }
  }

  if (loading) return <LoadingState label="Loading reports…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Scheduled Reports"
        subtitle="Generate and schedule recurring exports (CSV) of key datasets"
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <Button variant="secondary" onClick={async () => {
                try { const n = await invoke<number>("run_due_reports_cmd"); toast.success(`Ran ${n} due report(s)`); load(); }
                catch (err) { toast.error(`Failed: ${err}`); }
              }}><Play className="w-4 h-4" /> Run Due Now</Button>
            )}
            {canManage ? <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Report</Button> : undefined}
          </div>
        }
      />

      <Card className="p-4 text-sm text-slate-500">
        <p>Run a report to produce a CSV in the local <span className="font-mono">reports/</span> folder and raise an in-app notification. If <span className="font-mono">SMTP_HOST</span> is configured, due reports are emailed to the recipients automatically on a background schedule (daily / weekly / monthly).</p>
      </Card>

      {reports.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <FileBarChart className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-400 mb-2">No report schedules</p>
          <p className="text-sm">Create one to automate exports of work orders, timesheets, inventory or the audit log.</p>
        </Card>
      ) : (
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Dataset</th>
                <th className={thClass}>Format</th>
                <th className={thClass}>Frequency</th>
                <th className={thClass}>Recipients</th>
                <th className={thClass}>Last Run</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className={trClass}>
                  <td className={`${tdClass} font-semibold text-slate-800`}>{r.name}</td>
                  <td className={`${tdClass} capitalize text-slate-600`}>{r.dataset}</td>
                  <td className={`${tdClass} uppercase text-slate-600`}>{r.format}</td>
                  <td className={`${tdClass} capitalize text-slate-600`}>{r.frequency}</td>
                  <td className={`${tdClass} text-slate-600`}>{r.recipients || "—"}</td>
                  <td className={`${tdClass} text-slate-600`}>{r.last_run || "—"}</td>
                  <td className={tdClass}>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleRun(r)}><Play className="w-3.5 h-3.5" /> Run</Button>
                      {canManage && <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {showForm && canManage && (
        <Modal title="New Report Schedule" onClose={() => setShowForm(false)} maxWidth="max-w-md">
          <div className="space-y-4">
            <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Dataset">
              <Select value={form.dataset} onChange={(e) => setForm({ ...form, dataset: e.target.value })}>
                {DATASETS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Format">
              <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </Select>
            </Field>
            <Field label="Frequency">
              <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                {FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </Field>
            <Field label="Recipients (optional)"><Input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="email, email…" /></Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
