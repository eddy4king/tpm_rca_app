import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, Mic, Radio } from "lucide-react";
import { exportToCsv } from "../lib/export";
import { useToast } from "../context/ToastContext";
import { createDictation } from "../lib/voice";
import {
  loadDrafts,
  saveDraft,
  deleteDraft,
  type DowntimeDraft,
} from "../lib/drafts";
import TagScanner from "../components/TagScanner";
import PhotoCapture from "../components/PhotoCapture";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Badge,
  Field,
  StatCard,
  Info,
  PageHeader,
  TableCard,
  LoadingState,
  Banner,
  tableHeadClass,
  thClass,
  tdClass,
  trClass,
} from "../components/ui";

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
    case "Breakdown":
      return "bg-red-100 text-red-700 border-red-200";
    case "Setup":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "Minor Stoppage":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Speed Loss":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function formatDuration(min: number | null) {
  if (!min) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  }
  return `${min} min`;
}

const defaultForm = {
  equipment_id: "",
  title: "",
  description: "",
  loss_category: "Breakdown",
  start_time: new Date().toISOString().slice(0, 16),
  reported_by: "",
};

const defaultCloseForm = {
  end_time: new Date().toISOString().slice(0, 16),
};

function DowntimePage() {
  const toast = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [allDowntime, setAllDowntime] = useState<Downtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDowntime, setSelectedDowntime] = useState<Downtime | null>(null);
  const [editingDowntimeObj, setEditingDowntimeObj] = useState<Downtime | null>(null);

  const [ui, setUi] = useState({
    error: null as string | null,
    showForm: false,
    selectedEquipmentId: "",
    editingId: null as string | null,
  });

  const [form, setForm] = useState(defaultForm);
  const [closeForm, setCloseForm] = useState(defaultCloseForm);

  // Shop-floor capture: offline drafts + voice dictation + tag scanner.
  const [drafts, setDrafts] = useState<DowntimeDraft[]>(() => loadDrafts());
  const [showDrafts, setShowDrafts] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [listeningField, setListeningField] = useState<null | "title" | "description">(null);
  const dictationRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      dictationRef.current?.stop();
    };
  }, []);

  function startDictate(field: "title" | "description") {
    dictationRef.current?.stop();
    dictationRef.current = createDictation(
      (text) => {
        setForm((prev) => ({
          ...prev,
          [field]: (prev[field] ? prev[field] + " " : "") + text,
        }));
      },
      (listening) => setListeningField(listening ? field : null),
      (msg) => toast.error(msg)
    );
    dictationRef.current.start();
  }

  function handleSaveDraft() {
    if (!form.equipment_id && !form.title && !form.description) {
      toast.error("Nothing to save — fill in at least one field.");
      return;
    }
    saveDraft({
      equipment_id: form.equipment_id,
      title: form.title,
      description: form.description,
      loss_category: form.loss_category,
      start_time: form.start_time,
      reported_by: form.reported_by,
    });
    setDrafts(loadDrafts());
    toast.success("Draft saved on this device (offline)");
  }

  function resumeDraft(d: DowntimeDraft) {
    setForm({
      equipment_id: d.equipment_id,
      title: d.title,
      description: d.description,
      loss_category: d.loss_category,
      start_time: d.start_time,
      reported_by: d.reported_by,
    });
    setUi((prev) => ({ ...prev, showForm: true }));
    setShowDrafts(false);
    toast.success("Draft loaded");
  }

  function removeDraft(id: string) {
    deleteDraft(id);
    setDrafts(loadDrafts());
  }

  const equipmentMap = useMemo(() => {
    return new Map(equipment.map((eq) => [eq.id, eq]));
  }, [equipment]);

  const filteredDowntime = useMemo(() => {
    if (!ui.selectedEquipmentId) {
      return allDowntime;
    }
    return allDowntime.filter((d) => d.equipment_id === ui.selectedEquipmentId);
  }, [allDowntime, ui.selectedEquipmentId]);

  const calculatedDuration = useMemo(() => {
    if (!editingDowntimeObj?.start_time) return 0;
    return Math.max(
      0,
      Math.floor(
        (new Date(closeForm.end_time).getTime() -
          new Date(editingDowntimeObj.start_time).getTime()) /
          60000
      )
    );
  }, [editingDowntimeObj, closeForm.end_time]);

  const stats = useMemo(() => {
    const open = allDowntime.filter((d) => !d.end_time).length;
    const closed = allDowntime.filter((d) => d.end_time).length;
    const totalMinutes = allDowntime.reduce(
      (acc, d) => acc + (d.duration_minutes || 0),
      0
    );
    return { open, closed, totalMinutes };
  }, [allDowntime]);

  function resetForm() {
    setForm(defaultForm);
    setCloseForm(defaultCloseForm);
    setEditingDowntimeObj(null);
    setUi((prev) => ({ ...prev, editingId: null }));
  }

  function handleExport() {
    exportToCsv("downtime", filteredDowntime, [
      { key: "title", label: "Title" },
      {
        key: "equipment_id",
        label: "Equipment",
        format: (_v, row) => getEquipmentName(row.equipment_id),
      },
      { key: "loss_category", label: "Loss Category" },
      { key: "start_time", label: "Start Time" },
      { key: "end_time", label: "End Time" },
      { key: "duration_minutes", label: "Duration (min)" },
      { key: "reported_by", label: "Reported By" },
      {
        key: "end_time",
        label: "Status",
        format: (v) => (v ? "Closed" : "Open"),
      },
      { key: "description", label: "Description" },
      { key: "created_at", label: "Created At" },
    ]);
    toast.success(`Exported ${filteredDowntime.length} downtime events`);
  }

  function getEquipmentName(id: string) {
    const eq = equipmentMap.get(id);
    return eq ? `${eq.tag_number} — ${eq.name}` : id;
  }

  const loadDowntime = useCallback(async () => {
    try {
      const data = await invoke<Downtime[]>("get_all_downtime");
      setAllDowntime(data);
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const eq = await invoke<Equipment[]>("get_all_equipment");
      setEquipment(eq);
      await loadDowntime();
      setLoading(false);
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
      setLoading(false);
    }
  }, [loadDowntime]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async () => {
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
        await loadDowntime();
        resetForm();
        setUi((prev) => ({ ...prev, showForm: false }));
      } catch (err) {
        setUi((prev) => ({ ...prev, error: String(err) }));
      }
    },
    [form, loadDowntime]
  );

  const handleUpdate = useCallback(
    async () => {
      try {
        await invoke("update_downtime", {
          payload: {
            id: ui.editingId,
            title: form.title || null,
            description: form.description || null,
            lossCategory: form.loss_category || null,
            startTime: form.start_time || null,
            reportedBy: form.reported_by || null,
          },
        });
        await loadDowntime();
        resetForm();
        setUi((prev) => ({ ...prev, showForm: false }));
      } catch (err) {
        setUi((prev) => ({ ...prev, error: String(err) }));
      }
    },
    [form, loadDowntime, ui.editingId]
  );

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = confirm("Delete this downtime event?");
    if (!confirmed) return;
    try {
      await invoke("delete_downtime", { id });
      setAllDowntime((prev) => prev.filter((d) => d.id !== id));
      setSelectedDowntime(null);
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  const handleClose = useCallback(
    async (id: string) => {
      try {
        await invoke("close_downtime", {
          id,
          endTime: closeForm.end_time,
          durationMinutes: calculatedDuration,
        });
        await loadDowntime();
        resetForm();
        setUi((prev) => ({ ...prev, showForm: false }));
      } catch (err) {
        setUi((prev) => ({ ...prev, error: String(err) }));
      }
    },
    [calculatedDuration, closeForm.end_time, loadDowntime]
  );

  function handleEdit(dt: Downtime) {
    setEditingDowntimeObj(dt);
    setUi((prev) => ({ ...prev, editingId: dt.id, showForm: true }));
    setForm({
      equipment_id: dt.equipment_id,
      title: dt.title || "",
      description: dt.description || "",
      loss_category: dt.loss_category || "Breakdown",
      start_time: dt.start_time || new Date().toISOString().slice(0, 16),
      reported_by: dt.reported_by || "",
    });
    setSelectedDowntime(null);
  }

  if (loading) return <LoadingState label="Loading downtime records..." />;

  if (ui.error) return <Banner tone="error">{ui.error}</Banner>;

  if (selectedDowntime) {
    return (
      <div className="space-y-5 p-6 h-full overflow-y-auto">
        <button
          onClick={() => setSelectedDowntime(null)}
          className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Back to Downtime List
        </button>

        <Card className="p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-sm text-slate-500 font-mono">
                {getEquipmentName(selectedDowntime.equipment_id)}
              </p>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {selectedDowntime.title}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">Loss Category</p>
              <div className="mt-1">
                <Badge className={getLossCategoryColor(selectedDowntime.loss_category)}>
                  {selectedDowntime.loss_category}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-500">Status</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedDowntime.end_time
                      ? "bg-emerald-500"
                      : "bg-red-500 animate-pulse"
                  }`}
                />
                <span className="font-medium text-slate-700">
                  {selectedDowntime.end_time ? "Closed" : "Ongoing"}
                </span>
              </div>
            </div>

            <Info label="Start Time" value={selectedDowntime.start_time || "—"} />
            <Info label="End Time" value={selectedDowntime.end_time || "—"} />
            <Info
              label="Duration"
              value={formatDuration(selectedDowntime.duration_minutes)}
            />
            <Info label="Reported By" value={selectedDowntime.reported_by || "—"} />

            <div className="col-span-2">
              <Info label="Description" value={selectedDowntime.description || "—"} />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button variant="edit" onClick={() => handleEdit(selectedDowntime)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => handleDelete(selectedDowntime.id)}>
              Delete
            </Button>
          </div>

          <PhotoCapture recordType="downtime" recordId={selectedDowntime.id} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Downtime Logger"
        subtitle="Track all downtime events"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!filteredDowntime.length}
              onClick={handleExport}
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => setScannerOpen(true)}
            >
              <Radio className="w-4 h-4" /> Scan Tag
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowDrafts((v) => !v)}
            >
              Drafts{drafts.length ? ` (${drafts.length})` : ""}
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setUi((prev) => ({ ...prev, showForm: !prev.showForm }));
              }}
            >
              + Log Downtime
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-5">
        <StatCard label="Open Downtime" value={<span className="text-red-600">{stats.open}</span>} />
        <StatCard label="Closed Events" value={<span className="text-emerald-600">{stats.closed}</span>} />
        <StatCard
          label="Total Downtime"
          value={<span className="text-slate-900">{formatDuration(stats.totalMinutes)}</span>}
        />
      </div>

      <Card>
        <Select
          value={ui.selectedEquipmentId}
          onChange={(e) =>
            setUi((prev) => ({ ...prev, selectedEquipmentId: e.target.value }))
          }
        >
          <option value="">All Equipment</option>
          {equipment.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.tag_number} — {eq.name}
            </option>
          ))}
        </Select>
      </Card>

      {showDrafts && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Offline Drafts</h3>
            <span className="text-xs text-slate-400">
              Saved on this device — available without a connection
            </span>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-slate-400">
              No drafts yet. Start a downtime entry and tap “Save draft”.
            </p>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {d.title || "(untitled)"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {getEquipmentName(d.equipment_id)} ·{" "}
                      {new Date(d.savedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="edit" onClick={() => resumeDraft(d)}>
                      Resume
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeDraft(d.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {ui.showForm && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">
              {ui.editingId ? "Edit Downtime" : "Log Downtime"}
            </h3>
            <button
              onClick={() => setUi((prev) => ({ ...prev, showForm: false }))}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Equipment" className="col-span-2">
              <Select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
              >
                <option value="">Select Equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.tag_number} — {eq.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="relative">
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <button
                type="button"
                onClick={() => startDictate("title")}
                title="Dictate title"
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${
                  listeningField === "title"
                    ? "bg-rose-500 text-white animate-pulse"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <Select
              value={form.loss_category}
              onChange={(e) => setForm({ ...form, loss_category: e.target.value })}
            >
              <option>Breakdown</option>
              <option>Setup</option>
              <option>Minor Stoppage</option>
              <option>Speed Loss</option>
            </Select>

            <Input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />

            <Input
              placeholder="Reported By"
              value={form.reported_by}
              onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
            />

            <div className="relative col-span-2">
              <Textarea
                className="pr-10"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <button
                type="button"
                onClick={() => startDictate("description")}
                title="Dictate description"
                className={`absolute right-2 top-2 p-1.5 rounded-full ${
                  listeningField === "description"
                    ? "bg-rose-500 text-white animate-pulse"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            {editingDowntimeObj && !editingDowntimeObj.end_time && (
              <div className="col-span-2 border-t border-slate-200 pt-4 mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="font-semibold text-emerald-800 mb-3">
                  Close This Downtime
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="End Time">
                    <Input
                      type="datetime-local"
                      value={closeForm.end_time}
                      onChange={(e) => setCloseForm({ end_time: e.target.value })}
                    />
                  </Field>
                  <Field label="Duration">
                    <Input readOnly value={`${calculatedDuration} minutes`} className="bg-slate-100" />
                  </Field>
                  <Button
                    variant="success"
                    className="col-span-2"
                    onClick={() => handleClose(editingDowntimeObj.id)}
                  >
                    ✓ Confirm Close Downtime
                  </Button>
                </div>
              </div>
            )}

            <div className="col-span-2 flex gap-3">
              <Button
                variant="primary"
                className="flex-1"
                onClick={ui.editingId ? handleUpdate : handleCreate}
              >
                {ui.editingId ? "Update Downtime" : "Save Downtime Event"}
              </Button>
              {!ui.editingId && (
                <Button variant="secondary" onClick={handleSaveDraft}>
                  Save draft
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {filteredDowntime.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <p className="text-lg font-semibold text-slate-400 mb-2">No downtime events found</p>
          <p className="text-sm">Log a new event or adjust the equipment filter.</p>
        </Card>
      ) : (
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Equipment</th>
                <th className={thClass}>Title</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Duration</th>
                <th className={thClass}>Reported By</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>

            <tbody>
                {filteredDowntime.map((dt) => (
                  <tr
                    key={dt.id}
                    className={`${trClass} cursor-pointer`}
                    onClick={() => setSelectedDowntime(dt)}
                  >
                    <td className={`${tdClass} text-slate-700`}>
                      {getEquipmentName(dt.equipment_id)}
                    </td>
                    <td className={`${tdClass} font-medium text-slate-800`}>{dt.title}</td>
                    <td className={tdClass}>
                      <Badge className={getLossCategoryColor(dt.loss_category)}>
                        {dt.loss_category}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            dt.end_time ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                          }`}
                        />
                        <span className="text-slate-700">
                          {dt.end_time ? "Closed" : "Ongoing"}
                        </span>
                      </div>
                    </td>
                    <td className={`${tdClass} text-slate-700`}>
                      {formatDuration(dt.duration_minutes)}
                    </td>
                    <td className={`${tdClass} text-slate-700`}>{dt.reported_by || "—"}</td>
                    <td
                      className={tdClass}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-2">
                        <Button size="sm" variant="edit" onClick={() => handleEdit(dt)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(dt.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableCard>
      )}

      <TagScanner
        open={scannerOpen}
        equipment={equipment}
        onClose={() => setScannerOpen(false)}
        onSelect={(id) => {
          setForm((prev) => ({ ...prev, equipment_id: id }));
          toast.success("Equipment set from tag");
        }}
      />
    </div>
  );
}

export default DowntimePage;
