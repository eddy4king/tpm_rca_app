import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
  description: string | null;
  location: string | null;
  criticality: string | null;
  status: string | null;
  equipment_type: string | null;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function getStatusColor(status: string | null) {
  switch (status) {
    case "Running": return "bg-green-100 text-green-800";
    case "Standby": return "bg-blue-100 text-blue-800";
    case "Under Maintenance": return "bg-yellow-100 text-yellow-800";
    case "Failed": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getCriticalityColor(criticality: string | null) {
  switch (criticality) {
    case "Critical": return "bg-red-100 text-red-800";
    case "High": return "bg-orange-100 text-orange-800";
    case "Medium": return "bg-yellow-100 text-yellow-800";
    case "Low": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [form, setForm] = useState({
    tag_number: "",
    name: "",
    description: "",
    location: "",
    criticality: "Medium",
    status: "Running",
    equipment_type: "",
    parent_id: "",
  });

  useEffect(() => {
    loadEquipment();
  }, []);

  async function loadEquipment() {
    try {
      setLoading(true);
      const data = await invoke<Equipment[]>("get_all_equipment");
      setEquipment(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await invoke("create_equipment", {
        payload: {
          tag_number: form.tag_number,
          name: form.name,
          description: form.description || null,
          location: form.location,
          criticality: form.criticality,
          status: form.status,
          equipment_type: form.equipment_type,
          parent_id: form.parent_id || null,
        },
      });
      setShowForm(false);
      loadEquipment();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdate() {
    try {
      await invoke("update_equipment", {
        payload: {
          id: editingId,
          tag_number: form.tag_number || null,
          name: form.name || null,
          description: form.description || null,
          location: form.location || null,
          criticality: form.criticality || null,
          status: form.status || null,
          equipment_type: form.equipment_type || null,
        },
      });
      setShowForm(false);
      setEditingId(null);
      loadEquipment();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleEdit(eq: Equipment) {
    setEditingId(eq.id);
    setForm({
      tag_number: eq.tag_number || "",
      name: eq.name || "",
      description: eq.description || "",
      location: eq.location || "",
      criticality: eq.criticality || "Medium",
      status: eq.status || "Running",
      equipment_type: eq.equipment_type || "",
      parent_id: eq.parent_id || "",
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    try {
      await invoke("delete_equipment", { id });
      loadEquipment();
    } catch (err) {
      setError(String(err));
    }
  }

  if (loading) return <p className="text-gray-500">Loading equipment...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  if (selectedEquipment) {
    return (
      <div className="bg-white rounded shadow p-6 max-w-2xl">
        <button
          onClick={() => setSelectedEquipment(null)}
          className="text-slate-600 hover:text-slate-800 mb-4 flex items-center gap-1"
        >
          ← Back to Equipment List
        </button>
        <h2 className="text-2xl font-bold mb-6">{selectedEquipment.name}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Tag Number</p>
            <p className="font-medium">{selectedEquipment.tag_number || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Equipment Type</p>
            <p className="font-medium">{selectedEquipment.equipment_type || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Location</p>
            <p className="font-medium">{selectedEquipment.location || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEquipment.status)}`}>
              {selectedEquipment.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Criticality</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(selectedEquipment.criticality)}`}>
              {selectedEquipment.criticality}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Description</p>
            <p className="font-medium">{selectedEquipment.description || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{selectedEquipment.created_at || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Last Updated</p>
            <p className="font-medium">{selectedEquipment.updated_at || "—"}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => { handleEdit(selectedEquipment); setSelectedEquipment(null); }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-400"
          >
            Edit
          </button>
          <button
            onClick={() => { handleDelete(selectedEquipment.id); setSelectedEquipment(null); }}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Equipment Register</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600"
        >
          + Add Equipment
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded shadow mb-4 grid grid-cols-2 gap-4">
          <input className="border p-2 rounded" placeholder="Tag Number" value={form.tag_number} onChange={e => setForm({...form, tag_number: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Equipment Type" value={form.equipment_type} onChange={e => setForm({...form, equipment_type: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          <select className="border p-2 rounded" value={form.criticality} onChange={e => setForm({...form, criticality: e.target.value})}>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <select className="border p-2 rounded" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
            <option>Running</option>
            <option>Standby</option>
            <option>Under Maintenance</option>
            <option>Failed</option>
          </select>
          <input className="border p-2 rounded col-span-2" placeholder="Description (optional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <button
            onClick={editingId ? handleUpdate : handleCreate}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-500 col-span-2"
          >
            {editingId ? "Update Equipment" : "Save Equipment"}
          </button>
        </div>
      )}

      {equipment.length === 0 ? (
        <p className="text-gray-500">No equipment found.</p>
      ) : (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-slate-700 text-white">
            <tr>
              <th className="p-3 text-left">Tag</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Location</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Criticality</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq) => (
              <tr
                key={eq.id}
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedEquipment(eq)}
              >
                <td className="p-3">{eq.tag_number}</td>
                <td className="p-3">{eq.name}</td>
                <td className="p-3">{eq.equipment_type}</td>
                <td className="p-3">{eq.location}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(eq.status)}`}>
                    {eq.status}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(eq.criticality)}`}>
                    {eq.criticality}
                  </span>
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(eq)}
                    className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-400 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(eq.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default EquipmentPage;