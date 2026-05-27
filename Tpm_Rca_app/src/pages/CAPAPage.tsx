import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ClipboardCheck, Plus, Pencil, Trash2, User, CalendarDays, Search
} from "lucide-react";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

interface Investigation {
  id: string;
  equipment_id: string;
  title: string | null;
  status: string | null;
}

interface CAPA {
  id: string;
  investigation_id: string | null;
  title: string | null;
  owner: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string | null;
}

const statusStyles: Record<string, string> = {
  Open: "bg-red-100 text-red-700 border-red-200",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-200",
  Closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const priorityStyles: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

function CAPAPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedInvestigationId, setSelectedInvestigationId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCapa, setEditingCapa] = useState<CAPA | null>(null);
  const [form, setForm] = useState({
    title: "",
    owner: "",
    description: "",
    priority: "Medium",
    due_date: "",
    status: "Open",
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedEquipmentId) loadInvestigations(selectedEquipmentId);
  }, [selectedEquipmentId]);

  useEffect(() => {
    if (selectedInvestigationId) loadCapas(selectedInvestigationId);
    else setCapas([]);
  }, [selectedInvestigationId]);

  async function loadData() {
    try {
      setLoading(true);
      const eq = await invoke<Equipment[]>("get_all_equipment");
      setEquipment(eq);
      if (eq.length > 0) {
        setSelectedEquipmentId(eq[0].id);
        const inv = await invoke<Investigation[]>("get_investigations", { equipmentId: eq[0].id });
        setInvestigations(inv);
        if (inv.length > 0) {
          setSelectedInvestigationId(inv[0].id);
          const data = await invoke<CAPA[]>("get_investigation_capas", { investigationId: inv[0].id });
          setCapas(data);
        }
      }
      setLoading(false);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  async function loadInvestigations(equipmentId: string) {
    try {
      const inv = await invoke<Investigation[]>("get_investigations", { equipmentId });
      setInvestigations(inv);
      if (inv.length > 0) {
        setSelectedInvestigationId(inv[0].id);
      } else {
        setSelectedInvestigationId("");
        setCapas([]);
      }
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadCapas(investigationId: string) {
    try {
      const data = await invoke<CAPA[]>("get_investigation_capas", { investigationId });
      setCapas(data);
    } catch (err) {
      setError(String(err));
    }
  }

  function resetForm() {
    setForm({ title: "", owner: "", description: "", priority: "Medium", due_date: "", status: "Open" });
    setEditingCapa(null);
  }

  function openEditModal(capa: CAPA) {
    setEditingCapa(capa);
    setForm({
      title: capa.title || "",
      owner: capa.owner || "",
      description: capa.description || "",
      priority: capa.priority || "Medium",
      due_date: capa.due_date || "",
      status: capa.status || "Open",
    });
    setShowEditModal(true);
  }

  async function handleCreateCAPA() {
    if (!form.title || !selectedInvestigationId) return;
    try {
      await invoke("create_capa", {
        payload: {
          investigationId: selectedInvestigationId,
          title: form.title,
          owner: form.owner || null,
          description: form.description || null,
          priority: form.priority,
          dueDate: form.due_date || null,
        },
      });
      resetForm();
      setShowCreateModal(false);
      loadCapas(selectedInvestigationId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdateCAPA() {
    if (!editingCapa) return;
    try {
      await invoke("update_capa", {
        payload: {
          id: editingCapa.id,
          title: form.title || null,
          owner: form.owner || null,
          description: form.description || null,
          status: form.status || null,
          priority: form.priority || null,
          dueDate: form.due_date || null,
        },
      });
      resetForm();
      setEditingCapa(null);
      setShowEditModal(false);
      loadCapas(selectedInvestigationId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteCAPA(id: string) {
    if (!confirm("Delete this CAPA?")) return;
    try {
      await invoke("delete_capa", { id });
      setCapas(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(String(err));
    }
  }

  const filteredCapas = useMemo(() =>
    capas.filter(c => {
      const text = `${c.title || ""} ${c.description || ""} ${c.owner || ""}`.toLowerCase();
      return text.includes(search.toLowerCase());
    }),
    [capas, search]
  );

  const openCount = capas.filter(c => c.status === "Open").length;
  const progressCount = capas.filter(c => c.status === "In Progress").length;
  const closedCount = capas.filter(c => c.status === "Closed").length;

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading CAPA Workspace...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="flex flex-col bg-slate-100 text-slate-800" style={{ height: "calc(100vh - 80px)" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold">CAPA Management</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Corrective And Preventive Action Tracking System</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            disabled={!selectedInvestigationId}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New CAPA
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <select
            value={selectedEquipmentId}
            onChange={e => setSelectedEquipmentId(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-3 bg-white"
          >
            <option value="">Select Equipment</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
            ))}
          </select>

          <select
            value={selectedInvestigationId}
            onChange={e => setSelectedInvestigationId(e.target.value)}
            className="border border-slate-300 rounded-xl px-4 py-3 bg-white"
          >
            <option value="">Select Investigation</option>
            {investigations.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.title}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            <input
              placeholder="Search CAPAs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500">Total CAPAs</p>
            <h2 className="text-3xl font-bold mt-2">{capas.length}</h2>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-xs text-red-600">Open</p>
            <h2 className="text-3xl font-bold mt-2 text-red-700">{openCount}</h2>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs text-amber-600">In Progress</p>
            <h2 className="text-3xl font-bold mt-2 text-amber-700">{progressCount}</h2>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs text-emerald-600">Closed</p>
            <h2 className="text-3xl font-bold mt-2 text-emerald-700">{closedCount}</h2>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredCapas.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-400">No CAPAs Found</h2>
              <p className="text-sm text-slate-500 mt-2">
                {selectedInvestigationId ? "Create your first CAPA action." : "Select an investigation above."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredCapas.map(capa => (
              <div key={capa.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-800">{capa.title}</h2>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed line-clamp-2">
                      {capa.description || "No description provided"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(capa)} className="p-2 rounded-lg hover:bg-slate-100">
                      <Pencil className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => handleDeleteCAPA(capa.id)} className="p-2 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusStyles[capa.status || "Open"] || "bg-slate-100 text-slate-700"}`}>
                    {capa.status || "Open"}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityStyles[capa.priority || "Medium"] || "bg-slate-100 text-slate-700"}`}>
                    {capa.priority || "Medium"} Priority
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase">
                      <User className="w-3.5 h-3.5" /> Owner
                    </div>
                    <p className="font-medium mt-2 text-sm">{capa.owner || "Unassigned"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase">
                      <CalendarDays className="w-3.5 h-3.5" /> Due Date
                    </div>
                    <p className="font-medium mt-2 text-sm">
                      {capa.due_date ? new Date(capa.due_date).toLocaleDateString() : "No due date"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6">
            <h2 className="text-2xl font-bold mb-6">
              {showEditModal ? "Edit CAPA" : "Create New CAPA"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="CAPA Title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3"
              />
              <input
                placeholder="Owner"
                value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3"
              />
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical Priority</option>
              </select>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="border border-slate-300 rounded-xl px-4 py-3"
              />
              {showEditModal && (
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="border border-slate-300 rounded-xl px-4 py-3 md:col-span-2"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              )}
            </div>
            <textarea
              placeholder="Detailed Description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 h-32 resize-none mt-4"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}
                className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? handleUpdateCAPA : handleCreateCAPA}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium"
              >
                {showEditModal ? "Update CAPA" : "Create CAPA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CAPAPage;