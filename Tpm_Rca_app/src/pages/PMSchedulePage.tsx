import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus, Wrench, Calendar, User, Clock3, CheckCircle2,
  Pencil, Trash2, Search, Paperclip, X,
} from "lucide-react";
import { PriorityBadge } from "../components/indicators";
import {
  PageHeader, Card, Input, Select, Textarea, Button, IconButton, Badge,
  StatCard, Modal, LoadingState, Banner,
} from "../components/ui";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

interface PmSchedule {
  id: string;
  equipment_id: string;
  title: string | null;
  description: string | null;
  frequency: string | null;
  next_due_date: string | null;
  last_completed_at: string | null;
  assigned_to: string | null;
  status: string | null;
  priority: string | null;
  attachments: string | null;
  created_at: string | null;
}

const frequencyOptions = ["Daily", "Weekly", "Monthly", "Quarterly", "Annual"];

const statusStyles: Record<string, string> = {
  Pending: "bg-blue-100 text-blue-700 border-blue-200",
  Overdue: "bg-red-100 text-red-700 border-red-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const frequencyStyles: Record<string, string> = {
  Daily: "bg-purple-100 text-purple-700 border-purple-200",
  Weekly: "bg-blue-100 text-blue-700 border-blue-200",
  Monthly: "bg-amber-100 text-amber-700 border-amber-200",
  Quarterly: "bg-orange-100 text-orange-700 border-orange-200",
  Annual: "bg-red-100 text-red-700 border-red-200",
};

function getStatus(pm: PmSchedule): string {
  if (pm.status === "Completed") return "Completed";
  if (!pm.next_due_date) return "Pending";
  const due = new Date(pm.next_due_date);
  const now = new Date();
  return due < now ? "Overdue" : "Pending";
}

function getNextDueDate(frequency: string, from: Date = new Date()): string {
  const d = new Date(from);
  switch (frequency) {
    case "Daily": d.setDate(d.getDate() + 1); break;
    case "Weekly": d.setDate(d.getDate() + 7); break;
    case "Monthly": d.setMonth(d.getMonth() + 1); break;
    case "Quarterly": d.setMonth(d.getMonth() + 3); break;
    case "Annual": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

function PMSchedulePage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEquipmentId, setFilterEquipmentId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [editingPm, setEditingPm] = useState<PmSchedule | null>(null);
  const [completingPm, setCompletingPm] = useState<PmSchedule | null>(null);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [form, setForm] = useState({
    equipment_id: "",
    title: "",
    description: "",
    frequency: "Monthly",
    next_due_date: getNextDueDate("Monthly"),
    assigned_to: "",
    priority: "Medium",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [eq, pms] = await Promise.all([
        invoke<Equipment[]>("get_all_equipment"),
        invoke<PmSchedule[]>("get_all_pm_schedules"),
      ]);
      setEquipment(eq);
      setSchedules(pms);
      setLoading(false);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      equipment_id: "",
      title: "",
      description: "",
      frequency: "Monthly",
      next_due_date: getNextDueDate("Monthly"),
      assigned_to: "",
      priority: "Medium",
    });
    setAttachmentPaths([]);
    setEditingPm(null);
  }

  function openEdit(pm: PmSchedule) {
    setEditingPm(pm);
    setForm({
      equipment_id: pm.equipment_id,
      title: pm.title || "",
      description: pm.description || "",
      frequency: pm.frequency || "Monthly",
      next_due_date: pm.next_due_date || getNextDueDate("Monthly"),
      assigned_to: pm.assigned_to || "",
      priority: pm.priority || "Medium",
    });
    try {
      setAttachmentPaths(pm.attachments ? JSON.parse(pm.attachments) : []);
    } catch {
      setAttachmentPaths([]);
    }
    setShowForm(true);
  }

  async function handleCreate() {
    if (!form.title || !form.equipment_id) return;
    try {
      await invoke("create_pm_schedule", {
        payload: {
          equipmentId: form.equipment_id,
          title: form.title,
          description: form.description || null,
          frequency: form.frequency,
          nextDueDate: form.next_due_date || null,
          assignedTo: form.assigned_to || null,
          attachments: attachmentPaths.length > 0 ? JSON.stringify(attachmentPaths) : null,
          priority: form.priority,
        },
      });
      resetForm();
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdate() {
    if (!editingPm) return;
    try {
      await invoke("update_pm_schedule", {
        payload: {
          id: editingPm.id,
          title: form.title || null,
          description: form.description || null,
          frequency: form.frequency || null,
          nextDueDate: form.next_due_date || null,
          assignedTo: form.assigned_to || null,
          status: null,
          lastCompletedAt: null,
          attachments: attachmentPaths.length > 0 ? JSON.stringify(attachmentPaths) : null,
          priority: form.priority,
        },
      });
      resetForm();
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this PM schedule?")) return;
    try {
      await invoke("delete_pm_schedule", { id });
      setSchedules(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleComplete() {
    if (!completingPm) return;
    const nextDue = getNextDueDate(completingPm.frequency || "Monthly");
    try {
      await invoke("complete_pm_schedule", {
        id: completingPm.id,
        completedAt: new Date().toISOString(),
        nextDueDate: nextDue,
      });
      setShowCompleteModal(false);
      setCompletingPm(null);
      loadData();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      paths.push(files[i].name);
    }
    setAttachmentPaths(prev => [...prev, ...paths]);
  }

  function getEquipmentName(id: string) {
    const eq = equipment.find(e => e.id === id);
    return eq ? `${eq.tag_number} — ${eq.name}` : id;
  }

  const filtered = useMemo(() => {
    return schedules.filter(pm => {
      const status = getStatus(pm);
      const matchSearch = `${pm.title || ""} ${pm.assigned_to || ""} ${pm.description || ""}`.toLowerCase().includes(search.toLowerCase());
      const matchEquipment = filterEquipmentId ? pm.equipment_id === filterEquipmentId : true;
      const matchStatus = filterStatus ? status === filterStatus : true;
      const matchPriority = filterPriority ? (pm.priority || "Medium") === filterPriority : true;
      return matchSearch && matchEquipment && matchStatus && matchPriority;
    });
  }, [schedules, search, filterEquipmentId, filterStatus, filterPriority]);

  const stats = useMemo(() => {
    const total = schedules.length;
    const overdue = schedules.filter(pm => getStatus(pm) === "Overdue").length;
    const completed = schedules.filter(pm => getStatus(pm) === "Completed").length;
    const pending = schedules.filter(pm => getStatus(pm) === "Pending").length;
    return { total, overdue, completed, pending };
  }, [schedules]);

  if (loading) return <LoadingState label="Loading PM Scheduler..." />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="PM Scheduler"
          subtitle="Preventive Maintenance Schedule Management"
          actions={
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4" /> New PM Task
            </Button>
          }
        />

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <StatCard label="Total Tasks" value={<span className="text-slate-900">{stats.total}</span>} />
          <StatCard label="Overdue" value={<span className="text-red-700">{stats.overdue}</span>} />
          <StatCard label="Pending" value={<span className="text-blue-700">{stats.pending}</span>} />
          <StatCard label="Completed" value={<span className="text-emerald-700">{stats.completed}</span>} />
        </div>

        {/* FILTERS */}
        <Card className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filterEquipmentId}
              onChange={e => setFilterEquipmentId(e.target.value)}
            >
              <option value="">All Equipment</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
            </Select>
            <Select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
          </div>
        </Card>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-400">No PM Tasks Found</h2>
              <p className="text-sm text-slate-500 mt-2">Create your first preventive maintenance task.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filtered.map(pm => {
              const status = getStatus(pm);
              let attachments: string[] = [];
              try { attachments = pm.attachments ? JSON.parse(pm.attachments) : []; } catch { attachments = []; }

              return (
                <Card
                  key={pm.id}
                  className={`hover:shadow-md transition-shadow duration-200 border-l-4 ${status === "Overdue" ? "border-l-red-500" : "border-l-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-slate-900">{pm.title}</h2>
                      <p className="text-xs text-slate-400 mb-2">{getEquipmentName(pm.equipment_id)}</p>
                      <p className="text-sm text-slate-500 line-clamp-2">{pm.description || "No description"}</p>
                    </div>
                    <div className="flex gap-2">
                      <IconButton variant="edit" label="Edit" onClick={() => openEdit(pm)}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton variant="danger" label="Delete" onClick={() => handleDelete(pm.id)}>
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge className={statusStyles[status] || "bg-slate-100 text-slate-700 border-slate-200"}>
                      {status === "Overdue" && "⚠ "}{status}
                    </Badge>
                    <Badge className={frequencyStyles[pm.frequency || ""] || "bg-slate-100 text-slate-700 border-slate-200"}>
                      {pm.frequency}
                    </Badge>
                    <PriorityBadge priority={pm.priority} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1 text-xs text-slate-400 uppercase mb-1">
                        <Calendar className="w-3 h-3" /> Next Due
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {pm.next_due_date ? new Date(pm.next_due_date).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1 text-xs text-slate-400 uppercase mb-1">
                        <Clock3 className="w-3 h-3" /> Last Done
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {pm.last_completed_at ? new Date(pm.last_completed_at).toLocaleDateString() : "Never"}
                      </p>
                    </div>
                  </div>

                  {pm.assigned_to && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                      <User className="w-4 h-4" />
                      <span>{pm.assigned_to}</span>
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Paperclip className="w-3 h-3" /> Attachments ({attachments.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {attachments.map((a, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {status !== "Completed" && (
                    <Button
                      variant="success"
                      className="w-full mt-4"
                      onClick={() => { setCompletingPm(pm); setShowCompleteModal(true); }}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark as Complete
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <Modal
          title={editingPm ? "Edit PM Task" : "New PM Task"}
          onClose={() => { setShowForm(false); resetForm(); }}
          maxWidth="max-w-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              value={form.equipment_id}
              onChange={e => setForm({ ...form, equipment_id: e.target.value })}
              className="md:col-span-2"
            >
              <option value="">Select Equipment *</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </Select>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Task Title *</label>
              <Input
                placeholder="Task Title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Frequency</label>
              <Select
                value={form.frequency}
                onChange={e => setForm({ ...form, frequency: e.target.value, next_due_date: getNextDueDate(e.target.value) })}
              >
                {frequencyOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Next Due Date</label>
              <Input
                type="date"
                value={form.next_due_date}
                onChange={e => setForm({ ...form, next_due_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Priority</label>
              <Select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                <option value="Critical">Critical Priority</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Assigned To</label>
              <Input
                placeholder="Assigned To"
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Description (optional)</label>
              <Textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="h-28 resize-none"
              />
            </div>
          </div>

          {/* ATTACHMENTS */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-600 block mb-2">
              Attachments (Images / Videos)
            </label>
            <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 transition-colors">
              <Paperclip className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-500">Click to attach files</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
            {attachmentPaths.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {attachmentPaths.map((a, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg">
                    <span>{a}</span>
                    <button onClick={() => setAttachmentPaths(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove attachment">
                      <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={editingPm ? handleUpdate : handleCreate}>
              {editingPm ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </Modal>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && completingPm && (
        <Modal
          title="Mark as Complete"
          onClose={() => { setShowCompleteModal(false); setCompletingPm(null); }}
          maxWidth="max-w-md"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-100 p-3 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">This will log completion and schedule the next due date.</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 mb-5">
            <p className="font-semibold text-slate-800">{completingPm.title}</p>
            <p className="text-sm text-slate-500 mt-1">{getEquipmentName(completingPm.equipment_id)}</p>
            <div className="flex items-center gap-2 mt-3 text-sm text-slate-600">
              <Calendar className="w-4 h-4" />
              <span>Next due: <strong>{getNextDueDate(completingPm.frequency || "Monthly")}</strong></span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowCompleteModal(false); setCompletingPm(null); }}>
              Cancel
            </Button>
            <Button variant="success" className="flex-1" onClick={handleComplete}>
              Confirm Complete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PMSchedulePage;
