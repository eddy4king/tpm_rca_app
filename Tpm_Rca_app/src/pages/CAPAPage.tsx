import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ClipboardCheck, Plus, Pencil, Trash2, User, CalendarDays, Search, Download
} from "lucide-react";
import { exportToCsv } from "../lib/export";
import { useToast } from "../context/ToastContext";
import {
  PageHeader, Card, Input, Select, Textarea, Button, IconButton, Badge,
  StatCard, Modal, LoadingState, Banner,
} from "../components/ui";

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
  Low: "bg-slate-100 text-slate-600 border-slate-200",
  Medium: "bg-blue-100 text-blue-700 border-blue-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const priorityBorder: Record<string, string> = {
  Low: "border-l-slate-400",
  Medium: "border-l-blue-500",
  High: "border-l-orange-500",
  Critical: "border-l-red-500",
};

function CAPAPage() {
  const toast = useToast();
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

  if (loading) return <LoadingState label="Loading CAPA Workspace..." />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="CAPA Management"
          subtitle="Corrective And Preventive Action Tracking System"
          actions={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!filteredCapas.length}
                onClick={() => {
                  exportToCsv("capa", filteredCapas, [
                    { key: "title", label: "Title" },
                    { key: "owner", label: "Owner" },
                    { key: "status", label: "Status" },
                    { key: "priority", label: "Priority" },
                    { key: "due_date", label: "Due Date" },
                    { key: "description", label: "Description" },
                    { key: "created_at", label: "Created At" },
                  ]);
                  toast.success(`Exported ${filteredCapas.length} CAPA records`);
                }}
              >
                <Download className="w-4 h-4" /> Export CSV
              </Button>
              <Button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                disabled={!selectedInvestigationId}
              >
                <Plus className="w-4 h-4" /> New CAPA
              </Button>
            </div>
          }
        />

        <Card className="mt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              value={selectedEquipmentId}
              onChange={e => setSelectedEquipmentId(e.target.value)}
            >
              <option value="">Select Equipment</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </Select>

            <Select
              value={selectedInvestigationId}
              onChange={e => setSelectedInvestigationId(e.target.value)}
            >
              <option value="">Select Investigation</option>
              {investigations.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.title}</option>
              ))}
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search CAPAs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
          <StatCard label="Total CAPAs" value={<span className="text-slate-900">{capas.length}</span>} />
          <StatCard label="Open" value={<span className="text-red-700">{openCount}</span>} />
          <StatCard label="In Progress" value={<span className="text-amber-700">{progressCount}</span>} />
          <StatCard label="Closed" value={<span className="text-emerald-700">{closedCount}</span>} />
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
            {filteredCapas.map(capa => {
              const isOverdue = !!capa.due_date && capa.status !== "Closed" && new Date(capa.due_date) < new Date();
              return (
                <Card key={capa.id} className={`border-l-4 ${priorityBorder[capa.priority || "Medium"]} hover:shadow-md transition-shadow duration-200`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-slate-900">{capa.title}</h2>
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed line-clamp-2">
                        {capa.description || "No description provided"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <IconButton variant="edit" label="Edit" onClick={() => openEditModal(capa)}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton variant="danger" label="Delete" onClick={() => handleDeleteCAPA(capa.id)}>
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge className={statusStyles[capa.status || "Open"] || "bg-slate-100 text-slate-700 border-slate-200"}>
                      {capa.status || "Open"}
                    </Badge>
                    <Badge className={priorityStyles[capa.priority || "Medium"] || "bg-slate-100 text-slate-700 border-slate-200"}>
                      {capa.priority || "Medium"} Priority
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-5">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase">
                        <User className="w-3.5 h-3.5" /> Owner
                      </div>
                      <p className="font-medium mt-2 text-sm text-slate-800">{capa.owner || "Unassigned"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase">
                        <CalendarDays className="w-3.5 h-3.5" /> Due Date
                      </div>
                      <p className={`font-medium mt-2 text-sm ${isOverdue ? "text-red-600" : "text-slate-800"}`}>
                        {capa.due_date ? new Date(capa.due_date).toLocaleDateString() : "No due date"}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {(showCreateModal || showEditModal) && (
        <Modal
          title={showEditModal ? "Edit CAPA" : "Create New CAPA"}
          onClose={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}
          maxWidth="max-w-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">CAPA Title *</label>
              <Input
                placeholder="CAPA Title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Owner</label>
              <Input
                placeholder="Owner"
                value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Priority</label>
              <Select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical Priority</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Due Date</label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            {showEditModal && (
              <Select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="md:col-span-2"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </Select>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1.5 mt-4">Detailed Description</label>
            <Textarea
              placeholder="Detailed Description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="h-32 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={showEditModal ? handleUpdateCAPA : handleCreateCAPA}>
              {showEditModal ? "Update CAPA" : "Create CAPA"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default CAPAPage;
