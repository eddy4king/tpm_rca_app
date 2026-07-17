import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Button, Card, Input, Select, Textarea, Badge, PageHeader, StatCard, Field,
  TableCard, LoadingState, Banner, Modal, tableHeadClass, thClass, tdClass, trClass,
} from "../components/ui";
import { ClipboardList, Plus, Search, CheckCircle2, FileDown } from "lucide-react";
import { exportWorkOrderPdf } from "../lib/report";

interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  description: string | null;
  equipment_id: string | null;
  wo_type: string;
  source_id: string | null;
  status: string;
  priority: string;
  requested_by: string | null;
  assigned_to: string | null;
  planned_start: string | null;
  due_date: string | null;
  completed_at: string | null;
  approval_status: string;
  created_at: string | null;
  updated_at: string | null;
}

interface WoLabor { id: string; wo_id: string; person_name: string | null; minutes: number; rate: number | null; note: string | null; }
interface WoPart { id: string; wo_id: string; item_id: string | null; part_number: string | null; qty: number; unit_cost: number | null; }
interface Equipment { id: string; tag_number: string | null; name: string | null; }

const WO_TYPES = ["corrective", "preventive", "inspection"];
const STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const APPROVALS = ["none", "pending", "approved", "rejected"];

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  on_hold: "bg-slate-100 text-slate-600 border-slate-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};
const priorityColor: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const defaultForm = {
  title: "", description: "", equipment_id: "", wo_type: "corrective",
  priority: "medium", assigned_to: "", planned_start: "", due_date: "", approval_status: "none",
};

export default function WorkOrdersPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const canManage = canEdit("Technician");

  const [wos, setWos] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [labor, setLabor] = useState<WoLabor[]>([]);
  const [parts, setParts] = useState<WoPart[]>([]);

  const [laborOpen, setLaborOpen] = useState(false);
  const [laborForm, setLaborForm] = useState({ person_name: "", minutes: "", rate: "", note: "" });
  const [partOpen, setPartOpen] = useState(false);
  const [partForm, setPartForm] = useState({ item_id: "", qty: "", unit_cost: "" });
  const [items, setItems] = useState<{ id: string; part_number: string; name: string }[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [w, e] = await Promise.all([
        invoke<WorkOrder[]>("get_wos"),
        invoke<Equipment[]>("get_all_equipment"),
      ]);
      setWos(w);
      setEquipment(e);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const equipMap = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);
  const equipLabel = (id: string | null) => {
    if (!id) return "—";
    const e = equipMap.get(id);
    return e ? `${e.tag_number || ""} ${e.name || ""}`.trim() : "Unknown";
  };

  const filtered = useMemo(() => wos.filter((w) => {
    const matchesSearch = !search ||
      `${w.wo_number} ${w.title} ${w.assigned_to || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [wos, search, statusFilter]);

  const stats = useMemo(() => ({
    open: wos.filter((w) => w.status === "open" || w.status === "in_progress").length,
    completed: wos.filter((w) => w.status === "completed").length,
    overdue: wos.filter((w) => w.status !== "completed" && w.due_date && new Date(w.due_date) < new Date()).length,
  }), [wos]);

  function resetForm() { setForm(defaultForm); setEditingId(null); }
  function openNew(pre?: Partial<typeof defaultForm>) {
    setForm({ ...defaultForm, ...pre });
    setEditingId(null);
    setShowForm(true);
  }
  function openEdit(w: WorkOrder) {
    setForm({
      title: w.title, description: w.description || "", equipment_id: w.equipment_id || "",
      wo_type: w.wo_type, priority: w.priority, assigned_to: w.assigned_to || "",
      planned_start: w.planned_start || "", due_date: w.due_date || "", approval_status: w.approval_status,
    });
    setEditingId(w.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title) { toast.error("Title is required"); return; }
    try {
      const payload = {
        title: form.title, description: form.description || null,
        equipmentId: form.equipment_id || null, woType: form.wo_type,
        priority: form.priority, assignedTo: form.assigned_to || null,
        plannedStart: form.planned_start || null, dueDate: form.due_date || null,
        approvalStatus: form.approval_status,
      };
      if (editingId) {
        await invoke("update_wo", { payload: { id: editingId, ...payload } });
        toast.success("Work order updated");
      } else {
        await invoke("create_wo", { payload });
        toast.success("Work order created");
      }
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(`Save failed: ${err}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this work order?")) return;
    try {
      await invoke("delete_wo", { id });
      setWos((p) => p.filter((w) => w.id !== id));
      setSelected(null);
      toast.success("Work order deleted");
    } catch (err) { toast.error(`Delete failed: ${err}`); }
  }

  async function openDetail(w: WorkOrder) {
    try {
      const [l, p] = await Promise.all([
        invoke<WoLabor[]>("get_wo_labor", { woId: w.id }),
        invoke<WoPart[]>("get_wo_parts", { woId: w.id }),
      ]);
      setLabor(l);
      setParts(p);
      setSelected(w);
    } catch (err) { toast.error(`Could not load work order: ${err}`); }
  }

  const laborCost = labor.reduce((a, l) => a + (l.minutes / 60) * (l.rate || 0), 0);
  const partsCost = parts.reduce((a, p) => a + p.qty * (p.unit_cost || 0), 0);
  const totalCost = laborCost + partsCost;

  async function openLabor() {
    setLaborForm({ person_name: "", minutes: "", rate: "", note: "" });
    setLaborOpen(true);
  }
  async function handleAddLabor() {
    if (!selected || !laborForm.minutes || Number(laborForm.minutes) <= 0) { toast.error("Enter minutes"); return; }
    try {
      await invoke("add_wo_labor", { payload: {
        woId: selected.id, personName: laborForm.person_name || null,
        minutes: Number(laborForm.minutes), rate: laborForm.rate ? Number(laborForm.rate) : null,
        note: laborForm.note || null,
      }});
      const l = await invoke<WoLabor[]>("get_wo_labor", { woId: selected.id });
      setLabor(l);
      setLaborOpen(false);
    } catch (err) { toast.error(`Failed: ${err}`); }
  }

  async function openPart() {
    try {
      const it = await invoke<{ id: string; part_number: string; name: string }[]>("get_items");
      setItems(it);
    } catch { setItems([]); }
    setPartForm({ item_id: "", qty: "", unit_cost: "" });
    setPartOpen(true);
  }
  async function handleAddPart() {
    if (!selected || !partForm.qty || Number(partForm.qty) <= 0) { toast.error("Enter a quantity"); return; }
    try {
      await invoke("add_wo_part", { payload: {
        woId: selected.id, itemId: partForm.item_id || null,
        qty: Number(partForm.qty), unitCost: partForm.unit_cost ? Number(partForm.unit_cost) : null,
      }});
      const p = await invoke<WoPart[]>("get_wo_parts", { woId: selected.id });
      setParts(p);
      setPartOpen(false);
    } catch (err) { toast.error(`Failed: ${err}`); }
  }

  async function handleComplete() {
    if (!selected) return;
    try {
      await invoke("complete_wo", { id: selected.id });
      toast.success("Work order completed");
      load();
      openDetail({ ...selected, status: "completed" });
    } catch (err) { toast.error(`Failed: ${err}`); }
  }

  if (loading) return <LoadingState label="Loading work orders…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Work Orders"
        subtitle="Unified corrective, preventive & inspection work"
        actions={canManage ? <Button onClick={() => openNew()}><Plus className="w-4 h-4" /> New Work Order</Button> : undefined}
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<ClipboardList className="w-5 h-5" />} tint="blue" label="Active" value={<span className="text-blue-600">{stats.open}</span>} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} tint="emerald" label="Completed" value={<span className="text-emerald-600">{stats.completed}</span>} />
        <StatCard icon={<ClipboardList className="w-5 h-5" />} tint="rose" label="Overdue" value={<span className="text-rose-600">{stats.overdue}</span>} />
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input placeholder="Search WO #, title, assignee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-400 mb-2">No work orders</p>
          <p className="text-sm">Create a work order to track maintenance work.</p>
        </Card>
      ) : (
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>WO #</th>
                <th className={thClass}>Title</th>
                <th className={thClass}>Equipment</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Priority</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Due</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className={`${trClass} cursor-pointer`} onClick={() => openDetail(w)}>
                  <td className={`${tdClass} font-mono`}>{w.wo_number}</td>
                  <td className={`${tdClass} font-semibold text-slate-800`}>{w.title}</td>
                  <td className={`${tdClass} text-slate-600`}>{equipLabel(w.equipment_id)}</td>
                  <td className={`${tdClass} capitalize text-slate-600`}>{w.wo_type}</td>
                  <td className={tdClass}><Badge className={priorityColor[w.priority] || ""}>{w.priority}</Badge></td>
                  <td className={tdClass}><Badge className={statusColor[w.status] || ""}>{w.status.replace("_", " ")}</Badge></td>
                  <td className={`${tdClass} text-slate-600`}>{w.due_date || "—"}</td>
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {canManage ? (
                        <>
                          <Button size="sm" variant="edit" onClick={() => openEdit(w)}>Edit</Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(w.id)}>Delete</Button>
                        </>
                      ) : <span className="text-xs text-slate-400">View</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {showForm && canManage && (
        <Modal title={editingId ? "Edit Work Order" : "New Work Order"} onClose={() => setShowForm(false)} maxWidth="max-w-lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title *" className="col-span-2"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Type">
              <Select value={form.wo_type} onChange={(e) => setForm({ ...form, wo_type: e.target.value })}>
                {WO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Equipment" className="col-span-2">
              <Select value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}>
                <option value="">No equipment</option>
                {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.tag_number} {eq.name}</option>)}
              </Select>
            </Field>
            <Field label="Assigned To"><Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} /></Field>
            <Field label="Approval">
              <Select value={form.approval_status} onChange={(e) => setForm({ ...form, approval_status: e.target.value })}>
                {APPROVALS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Field>
            <Field label="Planned Start"><Input type="date" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} /></Field>
            <Field label="Due Date"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? "Update" : "Create"}</Button>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={`${selected.wo_number} — ${selected.title}`} onClose={() => setSelected(null)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={statusColor[selected.status] || ""}>{selected.status.replace("_", " ")}</Badge>
              <Badge className={priorityColor[selected.priority] || ""}>{selected.priority}</Badge>
              <span className="text-sm text-slate-500">Type: <span className="capitalize">{selected.wo_type}</span></span>
              <span className="text-sm text-slate-500">Equipment: {equipLabel(selected.equipment_id)}</span>
            </div>
            {selected.description && <p className="text-sm text-slate-700">{selected.description}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-700">Labor</h4>
                  {canManage && <Button size="sm" variant="secondary" onClick={openLabor}><Plus className="w-3.5 h-3.5" /> Add</Button>}
                </div>
                {labor.length === 0 ? <p className="text-xs text-slate-400">No labor logged.</p> : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                    {labor.map((l) => (
                      <div key={l.id} className="flex justify-between px-3 py-2 text-sm">
                        <span>{l.person_name || "Unnamed"} — {l.minutes} min{l.rate ? ` @ $${l.rate}/hr` : ""}</span>
                        {canManage && <button className="text-rose-500 text-xs" onClick={async () => { await invoke("remove_wo_labor", { id: l.id }); setLabor(await invoke<WoLabor[]>("get_wo_labor", { woId: selected.id })); }}>remove</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-700">Parts</h4>
                  {canManage && <Button size="sm" variant="secondary" onClick={openPart}><Plus className="w-3.5 h-3.5" /> Add</Button>}
                </div>
                {parts.length === 0 ? <p className="text-xs text-slate-400">No parts used.</p> : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                    {parts.map((p) => (
                      <div key={p.id} className="flex justify-between px-3 py-2 text-sm">
                        <span>{p.part_number || "Part"} × {p.qty}{p.unit_cost ? ` ($${p.unit_cost} ea)` : ""}</span>
                        {canManage && <button className="text-rose-500 text-xs" onClick={async () => { await invoke("remove_wo_part", { id: p.id }); setParts(await invoke<WoPart[]>("get_wo_parts", { woId: selected.id })); }}>remove</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <div className="text-sm">
                <p>Labor: <span className="font-semibold">${laborCost.toFixed(2)}</span></p>
                <p>Parts: <span className="font-semibold">${partsCost.toFixed(2)}</span></p>
                <p className="text-base font-bold text-slate-800">Total: ${totalCost.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => exportWorkOrderPdf(
                  {
                    wo_number: selected.wo_number,
                    title: selected.title,
                    description: selected.description,
                    status: selected.status,
                    priority: selected.priority,
                    wo_type: selected.wo_type,
                    equipment: equipLabel(selected.equipment_id),
                    assigned_to: selected.assigned_to,
                    due_date: selected.due_date,
                    approval_status: selected.approval_status,
                  },
                  labor.map((l) => ({ person_name: l.person_name, minutes: l.minutes, rate: l.rate, note: l.note })),
                  parts.map((p) => ({ part_number: p.part_number, qty: p.qty, unit_cost: p.unit_cost })),
                  totalCost
                )}>
                  <FileDown className="w-4 h-4" /> Export PDF
                </Button>
                {canManage && selected.status !== "completed" && (
                  <Button variant="edit" onClick={handleComplete}><CheckCircle2 className="w-4 h-4" /> Complete</Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {laborOpen && selected && (
        <Modal title="Add Labor" onClose={() => setLaborOpen(false)} maxWidth="max-w-sm">
          <div className="space-y-3">
            <Field label="Person / Crew"><Input value={laborForm.person_name} onChange={(e) => setLaborForm({ ...laborForm, person_name: e.target.value })} /></Field>
            <Field label="Minutes *"><Input type="number" value={laborForm.minutes} onChange={(e) => setLaborForm({ ...laborForm, minutes: e.target.value })} /></Field>
            <Field label="Rate / hr"><Input type="number" value={laborForm.rate} onChange={(e) => setLaborForm({ ...laborForm, rate: e.target.value })} placeholder="optional" /></Field>
            <Field label="Note"><Textarea value={laborForm.note} onChange={(e) => setLaborForm({ ...laborForm, note: e.target.value })} /></Field>
            <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setLaborOpen(false)}>Cancel</Button><Button onClick={handleAddLabor}>Add</Button></div>
          </div>
        </Modal>
      )}

      {partOpen && selected && (
        <Modal title="Add Part" onClose={() => setPartOpen(false)} maxWidth="max-w-sm">
          <div className="space-y-3">
            <Field label="Inventory Item">
              <Select value={partForm.item_id} onChange={(e) => setPartForm({ ...partForm, item_id: e.target.value })}>
                <option value="">Manual part (no stock link)</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.part_number} — {i.name}</option>)}
              </Select>
            </Field>
            <Field label="Quantity *"><Input type="number" value={partForm.qty} onChange={(e) => setPartForm({ ...partForm, qty: e.target.value })} /></Field>
            <Field label="Unit Cost"><Input type="number" value={partForm.unit_cost} onChange={(e) => setPartForm({ ...partForm, unit_cost: e.target.value })} placeholder="auto from item if linked" /></Field>
            <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setPartOpen(false)}>Cancel</Button><Button onClick={handleAddPart}>Add</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
