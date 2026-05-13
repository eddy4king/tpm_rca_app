import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Equipment {
  id: string;
  name: string | null;
  tag_number: string | null;
}

interface Downtime {
  id: string;
  equipment_id: string;
  title: string | null;
  description: string | null;
  loss_category: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  reported_by: string | null;
  created_at: string | null;
}

function getLossCategoryColor(category: string | null) {
  switch (category) {
    case "Breakdown": return "bg-red-100 text-red-800";
    case "Setup": return "bg-yellow-100 text-yellow-800";
    case "Minor Stoppage": return "bg-orange-100 text-orange-800";
    case "Speed Loss": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function DowntimePage() {
  const [downtimeList, setDowntimeList] = useState<Downtime[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedDowntime, setSelectedDowntime] = useState<Downtime | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [form, setForm] = useState({
    equipment_id: "",
    title: "",
    description: "",
    loss_category: "Breakdown",
    start_time: new Date().toISOString().slice(0, 16),
    reported_by: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const eq = await invoke<Equipment[]>("get_all_equipment");
      setEquipment(eq);
      setLoading(false);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  async function loadDowntime(equipment_id: string) {
    try {
      const data = await invoke<Downtime[]>("get_equipment_downtime", { equipmentId: equipment_id });
      setDowntimeList(data);
      setSelectedEquipmentId(equipment_id);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleCreate() {
    try {
      await invoke("create_downtime", {
        payload: {
          equipmentId: form.equipment_id,
          title: form.title,
          description: form.description || null,
          lossCategory: form.loss_category,
          startTime: form.start_time,
          reportedBy: form.reported_by || null,
        },
      });
      setShowForm(false);
      loadDowntime(form.equipment_id);
    } catch (err) {
      setError(String(err));
    }
  }

  function getEquipmentName(id: string) {
    const eq = equipment.find(e => e.id === id);
    return eq ? `${eq.tag_number} — ${eq.name}` : id;
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  if (selectedDowntime) {
    return (
      <div className="bg-white rounded shadow p-6 max-w-2xl">
        <button
          onClick={() => setSelectedDowntime(null)}
          className="text-slate-600 hover:text-slate-800 mb-4 flex items-center gap-1"
        >
          ← Back to Downtime List
        </button>
        <h2 className="text-2xl font-bold mb-2">{selectedDowntime.title}</h2>
        <p className="text-gray-500 mb-6">{getEquipmentName(selectedDowntime.equipment_id)}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Loss Category</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLossCategoryColor(selectedDowntime.loss_category)}`}>
              {selectedDowntime.loss_category}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedDowntime.end_time ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {selectedDowntime.end_time ? "Closed" : "Ongoing"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Start Time</p>
            <p className="font-medium">{selectedDowntime.start_time || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">End Time</p>
            <p className="font-medium">{selectedDowntime.end_time || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="font-medium">{selectedDowntime.duration_minutes ? `${selectedDowntime.duration_minutes} minutes` : "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Reported By</p>
            <p className="font-medium">{selectedDowntime.reported_by || "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-500">Description</p>
            <p className="font-medium">{selectedDowntime.description || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Logged At</p>
            <p className="font-medium">{selectedDowntime.created_at || "—"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Downtime Logger</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600"
        >
          + Log Downtime
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded shadow mb-4 grid grid-cols-2 gap-4">
          <select
            className="border p-2 rounded col-span-2"
            value={form.equipment_id}
            onChange={e => { setForm({...form, equipment_id: e.target.value}); loadDowntime(e.target.value); }}
          >
            <option value="">Select Equipment</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
            ))}
          </select>
          <input className="border p-2 rounded" placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <select className="border p-2 rounded" value={form.loss_category} onChange={e => setForm({...form, loss_category: e.target.value})}>
            <option>Breakdown</option>
            <option>Setup</option>
            <option>Minor Stoppage</option>
            <option>Speed Loss</option>
          </select>
          <input className="border p-2 rounded" type="datetime-local" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Reported By" value={form.reported_by} onChange={e => setForm({...form, reported_by: e.target.value})} />
          <input className="border p-2 rounded col-span-2" placeholder="Description (optional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <button onClick={handleCreate} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-500 col-span-2">
            Save Downtime Event
          </button>
        </div>
      )}

      <div className="mb-4">
        <select
          className="border p-2 rounded bg-white"
          value={selectedEquipmentId}
          onChange={e => loadDowntime(e.target.value)}
        >
          <option value="">Filter by Equipment</option>
          {equipment.map(eq => (
            <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
          ))}
        </select>
      </div>

      {downtimeList.length === 0 ? (
        <p className="text-gray-500">No downtime events found. Select equipment above to view its history.</p>
      ) : (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-slate-700 text-white">
            <tr>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Start Time</th>
              <th className="p-3 text-left">End Time</th>
              <th className="p-3 text-left">Duration</th>
              <th className="p-3 text-left">Reported By</th>
            </tr>
          </thead>
          <tbody>
            {downtimeList.map((dt) => (
              <tr
                key={dt.id}
                className="border-b hover:bg-blue-50 cursor-pointer"
                onClick={() => setSelectedDowntime(dt)}
              >
                <td className="p-3 font-medium">{dt.title}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLossCategoryColor(dt.loss_category)}`}>
                    {dt.loss_category}
                  </span>
                </td>
                <td className="p-3">{dt.start_time}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${dt.end_time ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {dt.end_time || "Ongoing"}
                  </span>
                </td>
                <td className="p-3">{dt.duration_minutes ? `${dt.duration_minutes} min` : "—"}</td>
                <td className="p-3">{dt.reported_by || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default DowntimePage;