import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus, Wrench, Calendar, User, Clock3, CheckCircle2,
  AlertTriangle, Pencil, Trash2, Search, Paperclip, X,
} from "lucide-react";

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
  Daily: "bg-purple-100 text-purple-700",
  Weekly: "bg-blue-100 text-blue-700",
  Monthly: "bg-amber-100 text-amber-700",
  Quarterly: "bg-orange-100 text-orange-700",
  Annual: "bg-red-100 text-red-700",
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
      return matchSearch && matchEquipment && matchStatus;
    });
  }, [schedules, search, filterEquipmentId, filterStatus]);

  const stats = useMemo(() => {
    const total = schedules.length;
    const overdue = schedules.filter(pm => getStatus(pm) === "Overdue").length;
    const completed = schedules.filter(pm => getStatus(pm) === "Completed").length;
    const pending = schedules.filter(pm => getStatus(pm) === "Pending").length;
    return { total, overdue, completed, pending };
  }, [schedules]);

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading PM Scheduler...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="flex flex-col bg-slate-100 text-slate-800" style={{ height: "calc(100vh - 80px)" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold">PM Scheduler</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Preventive Maintenance Schedule Management</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New PM Task
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500">Total Tasks</p>
            <h2 className="text-3xl font-bold mt-1">{stats.total}</h2>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-xs text-red-600">Overdue</p>
            <h2 className="text-3xl font-bold mt-1 text-red-700">{stats.overdue}</h2>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs text-blue-600">Pending</p>
            <h2 className="text-3xl font-bold mt-1 text-blue-700">{stats.pending}</h2>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs text-emerald-600">Completed</p>
            <h2 className="text-3xl font-bold mt-1 text-emerald-700">{stats.completed}</h2>
          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            <input
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3"
            />
          </div>
          <select
            value={filterEquipmentId}
            onChange={e => setFilterEquipmentId(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-3 bg-white"
          >
            <option value="">All Equipment</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-3 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
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
                <div key={pm.id} className={`bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition ${status === "Overdue" ? "border-red-200" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-slate-800">{pm.title}</h2>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{getEquipmentName(pm.equipment_id)}</p>
                      <p className="text-sm text-slate-500 line-clamp-2">{pm.description || "No description"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(pm)} className="p-2 rounded-lg hover:bg-slate-100">
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                      <button onClick={() => handleDelete(pm.id)} className="p-2 rounded-lg hover:bg-red-50">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusStyles[status] || "bg-slate-100 text-slate-700"}`}>
                      {status === "Overdue" && "⚠ "}{status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${frequencyStyles[pm.frequency || ""] || "bg-slate-100 text-slate-700"}`}>
                      {pm.frequency}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1 text-xs text-slate-400 uppercase mb-1">
                        <Calendar className="w-3 h-3" /> Next Due
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {pm.next_due_date ? new Date(pm.next_due_date).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1 text-xs text-slate-400 uppercase mb-1">
                        <Clock3 className="w-3 h-3" /> Last Done
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
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
                    <button
                      onClick={() => { setCompletingPm(pm); setShowCompleteModal(true); }}
                      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark as Complete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">{editingPm ? "Edit PM Task" : "New PM Task"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={form.equipment_id}
                onChange={e => setForm({ ...form, equipment_id: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3 md:col-span-2"
              >
                <option value="">Select Equipment *</option>
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
                ))}
              </select>
              <input
                placeholder="Task Title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3 md:col-span-2"
              />
              <select
                value={form.frequency}
                onChange={e => setForm({ ...form, frequency: e.target.value, next_due_date: getNextDueDate(e.target.value) })}
                className="border border-slate-300 rounded-xl px-4 py-3"
              >
                {frequencyOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <input
                type="date"
                value={form.next_due_date}
                onChange={e => setForm({ ...form, next_due_date: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3"
              />
              <input
                placeholder="Assigned To"
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3 md:col-span-2"
              />
              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 h-28 resize-none md:col-span-2"
              />
            </div>

            {/* ATTACHMENTS */}
            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-600 block mb-2">
                Attachments (Images / Videos)
              </label>
              <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 transition">
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
                      <button onClick={() => setAttachmentPaths(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={editingPm ? handleUpdate : handleCreate}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium"
              >
                {editingPm ? "Update Task" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && completingPm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 p-3 rounded-2xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Mark as Complete</h2>
                <p className="text-sm text-slate-500">This will log completion and schedule the next due date.</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 mb-5">
              <p className="font-semibold text-slate-700">{completingPm.title}</p>
              <p className="text-sm text-slate-500 mt-1">{getEquipmentName(completingPm.equipment_id)}</p>
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Next due: <strong>{getNextDueDate(completingPm.frequency || "Monthly")}</strong></span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCompleteModal(false); setCompletingPm(null); }} className="flex-1 py-3 rounded-xl border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleComplete} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium">
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PMSchedulePage;