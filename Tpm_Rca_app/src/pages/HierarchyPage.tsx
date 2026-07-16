import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import {
  Building2, MapPin, Cog, Plus, Trash2, Search,
} from "lucide-react";
import { StatusBadge } from "../components/indicators";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Field,
  Modal,
  StatCard,
  PageHeader,
  LoadingState,
  Banner,
} from "../components/ui";

interface Plant { id: string; name: string | null; code: string | null; description: string | null; location: string | null; }
interface Area { id: string; plant_id: string; name: string | null; code: string | null; description: string | null; }
interface Equipment {
  id: string; tag_number: string | null; name: string | null; status: string | null;
  criticality: string | null; area_id: string | null;
}

export default function HierarchyPage() {
  const { canEdit } = useAuth();
  const canManage = canEdit("Engineer");

  const [plants, setPlants] = useState<Plant[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showPlant, setShowPlant] = useState(false);
  const [showArea, setShowArea] = useState(false);
  const [plantForm, setPlantForm] = useState({ name: "", code: "", description: "", location: "" });
  const [areaForm, setAreaForm] = useState({ plant_id: "", name: "", code: "", description: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, a, e] = await Promise.all([
        invoke<Plant[]>("get_all_plants"),
        invoke<Area[]>("get_all_areas"),
        invoke<Equipment[]>("get_all_equipment"),
      ]);
      setPlants(p); setAreas(a); setEquipment(e);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    const q = search.toLowerCase();
    const matchEq = (e: Equipment) =>
      !q || `${e.tag_number} ${e.name}`.toLowerCase().includes(q);

    const nodes = plants.map(plant => {
      const plantAreas = areas
        .filter(a => a.plant_id === plant.id)
        .map(area => ({
          ...area,
          equipment: equipment.filter(e => e.area_id === area.id && matchEq(e)),
        }));
      return { plant, areas: plantAreas };
    }).filter(node =>
      !q ||
      node.plant.name?.toLowerCase().includes(q) ||
      node.areas.some(a => a.name?.toLowerCase().includes(q) || a.equipment.length > 0)
    );

    const unassigned = equipment.filter(e => !e.area_id && matchEq(e));
    return { nodes, unassigned };
  }, [plants, areas, equipment, search]);

  async function handleCreatePlant() {
    if (!plantForm.name) return;
    try {
      await invoke("create_plant", { payload: { ...plantForm, code: plantForm.code || null, description: plantForm.description || null, location: plantForm.location || null } });
      setShowPlant(false); setPlantForm({ name: "", code: "", description: "", location: "" });
      load();
    } catch (err) { setError(String(err)); }
  }

  async function handleCreateArea() {
    if (!areaForm.name || !areaForm.plant_id) return;
    try {
      await invoke("create_area", { payload: { ...areaForm, code: areaForm.code || null, description: areaForm.description || null } });
      setShowArea(false); setAreaForm({ plant_id: "", name: "", code: "", description: "" });
      load();
    } catch (err) { setError(String(err)); }
  }

  async function handleDeletePlant(id: string) {
    if (!confirm("Delete this plant and its areas?")) return;
    try { await invoke("delete_plant", { id }); load(); } catch (err) { setError(String(err)); }
  }

  async function handleDeleteArea(id: string) {
    if (!confirm("Delete this area?")) return;
    try { await invoke("delete_area", { id }); load(); } catch (err) { setError(String(err)); }
  }

  async function reassignEquipment(eqId: string, areaId: string | null) {
    const eq = equipment.find(e => e.id === eqId);
    if (!eq) return;
    try {
      await invoke("update_equipment", {
        payload: {
          id: eq.id,
          tagNumber: eq.tag_number,
          name: eq.name,
          description: null,
          location: null,
          criticality: eq.criticality,
          status: eq.status,
          equipmentType: null,
          parentId: null,
          areaId: areaId || null,
        },
      });
      setEquipment(prev => prev.map(e => e.id === eqId ? { ...e, area_id: areaId } : e));
    } catch (err) { setError(String(err)); }
  }

  if (loading) return <LoadingState label="Loading hierarchy…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="Plant Hierarchy"
          subtitle="Plant → Area → Equipment structure"
          live
          actions={
            canManage ? (
              <div className="flex gap-2">
                <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => setShowArea(true)}>
                  <Plus className="w-4 h-4" /> Add Area
                </Button>
                <Button onClick={() => setShowPlant(true)}>
                  <Plus className="w-4 h-4" /> Add Plant
                </Button>
              </div>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <StatCard label="Plants" value={<span className="text-slate-900">{plants.length}</span>} />
          <StatCard label="Areas" value={<span className="text-blue-700">{areas.length}</span>} />
          <StatCard label="Equipment" value={<span className="text-amber-700">{equipment.length}</span>} />
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search equipment or plant…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {tree.nodes.length === 0 && tree.unassigned.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-400 mb-2">No plants yet</p>
            <p>Add a plant to begin building the hierarchy.</p>
          </div>
        )}

        {tree.nodes.map(({ plant, areas: plantAreas }) => (
          <Card key={plant.id} className="overflow-hidden !p-0">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5" />
                <div>
                  <h2 className="font-bold text-slate-50">{plant.name}</h2>
                  <p className="text-xs text-slate-300">{plant.code || "—"} · {plant.location || "No location"}</p>
                </div>
              </div>
              {canManage && (
                <button onClick={() => handleDeletePlant(plant.id)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Delete plant">
                  <Trash2 className="w-4 h-4 text-red-300" />
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {plantAreas.length === 0 && (
                <p className="px-1 py-2 text-sm text-slate-400">No areas defined for this plant.</p>
              )}
              {plantAreas.map(area => (
                <div key={area.id} className="border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between px-4 py-3 bg-blue-50/60">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-700">{area.name}</span>
                      <span className="text-xs text-slate-400">{area.equipment.length} assets</span>
                    </div>
                    {canManage && (
                      <button onClick={() => handleDeleteArea(area.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" aria-label="Delete area">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {area.equipment.map(eq => (
                      <EquipmentRow key={eq.id} eq={eq} canManage={canManage} areas={plantAreas} onReassign={reassignEquipment} />
                    ))}
                    {area.equipment.length === 0 && (
                      <p className="px-4 py-3 text-sm text-slate-400">No equipment assigned to this area.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {tree.unassigned.length > 0 && (
          <Card className="border-dashed">
            <div className="px-5 py-4 flex items-center gap-2">
              <Cog className="w-5 h-5 text-slate-400" />
              <h2 className="font-bold text-slate-700">Unassigned Equipment</h2>
              <span className="text-xs text-slate-400">{tree.unassigned.length} assets</span>
            </div>
            <div className="divide-y divide-slate-100 px-4 pb-4">
              {tree.unassigned.map(eq => (
                <EquipmentRow key={eq.id} eq={eq} canManage={canManage} areas={[]} onReassign={reassignEquipment} />
               ))}
             </div>
           </Card>
        )}
      </div>

      {showPlant && (
        <Modal title="Add Plant" onClose={() => setShowPlant(false)}>
          <Field label="Plant Name *"><Input value={plantForm.name} onChange={e => setPlantForm({ ...plantForm, name: e.target.value })} /></Field>
          <Field label="Code"><Input value={plantForm.code} onChange={e => setPlantForm({ ...plantForm, code: e.target.value })} /></Field>
          <Field label="Location"><Input value={plantForm.location} onChange={e => setPlantForm({ ...plantForm, location: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={plantForm.description} onChange={e => setPlantForm({ ...plantForm, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" onClick={() => setShowPlant(false)}>Cancel</Button>
            <Button onClick={handleCreatePlant}>Create Plant</Button>
          </div>
        </Modal>
      )}

      {showArea && (
        <Modal title="Add Area" onClose={() => setShowArea(false)}>
          <Field label="Plant *">
            <Select value={areaForm.plant_id} onChange={e => setAreaForm({ ...areaForm, plant_id: e.target.value })}>
              <option value="">Select Plant</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Area Name *"><Input value={areaForm.name} onChange={e => setAreaForm({ ...areaForm, name: e.target.value })} /></Field>
          <Field label="Code"><Input value={areaForm.code} onChange={e => setAreaForm({ ...areaForm, code: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={areaForm.description} onChange={e => setAreaForm({ ...areaForm, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" onClick={() => setShowArea(false)}>Cancel</Button>
            <Button onClick={handleCreateArea}>Create Area</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EquipmentRow({ eq, canManage, areas, onReassign }: {
  eq: Equipment; canManage: boolean; areas: Area[]; onReassign: (id: string, areaId: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <Cog className="w-4 h-4 text-slate-400" />
        <div>
          <p className="text-sm font-medium text-slate-800">{eq.tag_number} — {eq.name}</p>
          <p className="text-xs text-slate-400">{eq.criticality} criticality</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label={eq.status} kind="equipment" />
        {canManage && (
          <select
            value={eq.area_id || ""}
            onChange={e => onReassign(eq.id, e.target.value || null)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Unassigned</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
