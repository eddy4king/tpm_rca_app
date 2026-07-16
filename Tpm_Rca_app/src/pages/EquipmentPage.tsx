import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { StatusBadge, LiveIndicator } from "../components/indicators";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Badge,
  Info,
  PageHeader,
  StatCard,
  Field,
  TableCard,
  LoadingState,
  Banner,
  Modal,
  tableHeadClass,
  thClass,
  tdClass,
  trClass,
} from "../components/ui";
import {
  Search, Plus, Pencil, Trash2, Cog, ChevronLeft, Layers, Download, QrCode as QrIcon, Upload,
} from "lucide-react";
import { exportToCsv } from "../lib/export";
import { parseCsv, normalizeHeader } from "../lib/csv";
import QrCode, { equipmentQrValue, parseEquipmentQr } from "../components/QrCode";

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
  area_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Area { id: string; plant_id: string; name: string | null; }
interface Plant { id: string; name: string | null; }

interface ImportRow {
  tag_number: string;
  name: string;
  description: string | null;
  location: string | null;
  criticality: string;
  status: string;
  equipment_type: string | null;
  parent_id: string | null;
  area_id: string | null;
}

const VALID_STATUS = ["Running", "Standby", "Under Maintenance", "Failed"];
const VALID_CRITICALITY = ["Critical", "High", "Medium", "Low"];

const FIELD_ALIASES: Record<keyof ImportRow, string[]> = {
  tag_number: ["tagnumber", "tag", "tagnum", "tagno"],
  name: ["name", "equipmentname", "equipment", "assetname", "asset"],
  equipment_type: ["type", "equipmenttype"],
  status: ["status", "state"],
  criticality: ["criticality", "criticalitylevel", "priority"],
  location: ["location", "site", "place"],
  area_id: ["area", "areaid", "arename"],
  description: ["description", "desc", "notes", "remarks"],
  parent_id: ["parent", "parentid", "parenttag"],
};

const IMPORT_FIELDS: { key: keyof ImportRow; label: string; required: boolean; hint?: string }[] = [
  { key: "tag_number", label: "Tag Number", required: true },
  { key: "name", label: "Name", required: true },
  { key: "equipment_type", label: "Equipment Type", required: false },
  { key: "status", label: "Status", required: false, hint: "Running / Standby / Under Maintenance / Failed" },
  { key: "criticality", label: "Criticality", required: false, hint: "Critical / High / Medium / Low" },
  { key: "location", label: "Location", required: false },
  { key: "area_id", label: "Area", required: false, hint: "Area name or ID (matches export)" },
  { key: "description", label: "Description", required: false },
  { key: "parent_id", label: "Parent ID/Tag", required: false },
];

function normalizeValue(value: string | undefined, fallback: string): string {
  const v = (value || "").trim();
  return v || fallback;
}

function normalizeStatus(value: string | undefined): string {
  const v = normalizeValue(value, "Running");
  return VALID_STATUS.includes(v) ? v : "Running";
}

function normalizeCriticality(value: string | undefined): string {
  const v = normalizeValue(value, "Medium");
  return VALID_CRITICALITY.includes(v) ? v : "Medium";
}

const defaultForm = {
  tag_number: "",
  name: "",
  description: "",
  location: "",
  criticality: "Medium",
  status: "Running",
  equipment_type: "",
  parent_id: "",
  area_id: "",
};

function getCriticalityColor(criticality: string | null) {
  switch (criticality) {
    case "Critical": return "bg-red-100 text-red-700 border-red-200";
    case "High": return "bg-orange-100 text-orange-700 border-orange-200";
    case "Medium": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Low": return "bg-slate-100 text-slate-600 border-slate-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function initialsOf(eq: Equipment) {
  const base = eq.name || eq.tag_number || "?";
  return base.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 2).toUpperCase();
}

function EquipmentPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupValue, setLookupValue] = useState("");
  const canEditEquipment = canEdit("Engineer");

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<keyof ImportRow, number>>({
    tag_number: -1, name: -1, equipment_type: -1, status: -1,
    criticality: -1, location: -1, area_id: -1, description: -1, parent_id: -1,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ui, setUi] = useState({
    error: null as string | null,
    showForm: false,
    editingId: null as string | null,
    search: "",
    statusFilter: "",
    criticalityFilter: "",
    typeFilter: "",
  });

  const [form, setForm] = useState(defaultForm);

  const stats = useMemo(() => ({
    total: equipment.length,
    running: equipment.filter((e) => e.status === "Running").length,
    failed: equipment.filter((e) => e.status === "Failed").length,
    maintenance: equipment.filter((e) => e.status === "Under Maintenance").length,
  }), [equipment]);

  const equipmentTypes = useMemo(
    () => [...new Set(equipment.map((e) => e.equipment_type).filter(Boolean))] as string[],
    [equipment]
  );

  const filteredEquipment = useMemo(() => equipment.filter((eq) => {
    const matchesSearch = !ui.search ||
      `${eq.tag_number} ${eq.name} ${eq.location} ${eq.equipment_type}`.toLowerCase().includes(ui.search.toLowerCase());
    const matchesStatus = !ui.statusFilter || eq.status === ui.statusFilter;
    const matchesCriticality = !ui.criticalityFilter || eq.criticality === ui.criticalityFilter;
    const matchesType = !ui.typeFilter || eq.equipment_type === ui.typeFilter;
    return matchesSearch && matchesStatus && matchesCriticality && matchesType;
  }), [equipment, ui]);

  const preview = useMemo(() => buildImportRows(mapping), [mapping, csvRows]);

  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const plantMap = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  function areaLabel(areaId: string | null) {
    if (!areaId) return "—";
    const a = areaMap.get(areaId);
    if (!a) return "—";
    const plant = plantMap.get(a.plant_id);
    return `${plant?.name || "Plant"} / ${a.name || "Area"}`;
  }

  const loadEquipment = useCallback(async () => {
    try {
      setLoading(true);
      const [eq, ar, pl] = await Promise.all([
        invoke<Equipment[]>("get_all_equipment"),
        invoke<Area[]>("get_all_areas"),
        invoke<Plant[]>("get_all_plants"),
      ]);
      setEquipment(eq);
      setAreas(ar);
      setPlants(pl);
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  function resetForm() {
    setForm(defaultForm);
    setUi((prev) => ({ ...prev, editingId: null }));
  }

  async function handleCreate() {
    try {
      await invoke("create_equipment", {
        payload: {
          tagNumber: form.tag_number,
          name: form.name,
          description: form.description || null,
          location: form.location || null,
          criticality: form.criticality,
          status: form.status,
          equipmentType: form.equipment_type || null,
          parentId: form.parent_id || null,
          areaId: form.area_id || null,
        },
      });
      await loadEquipment();
      resetForm();
      setUi((prev) => ({ ...prev, showForm: false }));
      toast.success(`Equipment "${form.tag_number}" created`);
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
      toast.error(`Failed to create equipment: ${err}`);
    }
  }

  async function handleUpdate() {
    try {
      await invoke("update_equipment", {
        payload: {
          id: ui.editingId,
          tagNumber: form.tag_number || null,
          name: form.name || null,
          description: form.description || null,
          location: form.location || null,
          criticality: form.criticality || null,
          status: form.status || null,
          equipmentType: form.equipment_type || null,
          parentId: form.parent_id || null,
          areaId: form.area_id || null,
        },
      });
      await loadEquipment();
      resetForm();
      setUi((prev) => ({ ...prev, showForm: false }));
      toast.success("Equipment updated");
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
      toast.error(`Failed to update equipment: ${err}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this equipment?")) return;
    try {
      await invoke("delete_equipment", { id });
      setEquipment((prev) => prev.filter((eq) => eq.id !== id));
      setSelectedEquipment(null);
      toast.success("Equipment deleted");
    } catch (err) {
      setUi((prev) => ({ ...prev, error: String(err) }));
      toast.error(`Failed to delete equipment: ${err}`);
    }
  }

  function resolveArea(raw: string): string | null {
    if (!raw) return null;
    // Accept an id, an area name, or the "Plant / Area" label used by export.
    const candidates = [raw, raw.split("/").pop()?.trim(), raw.split("/")[0]?.trim()]
      .filter((c): c is string => !!c);
    for (const c of candidates) {
      const a = areas.find(
        (x) => x.id === c || (x.name || "").toLowerCase() === c.toLowerCase()
      );
      if (a) return a.id;
    }
    return null;
  }

  function autoMap(headers: string[]): Record<keyof ImportRow, number> {
    const norm = headers.map(normalizeHeader);
    const find = (aliases: string[]) => norm.findIndex((h) => aliases.includes(h));
    return {
      tag_number: find(FIELD_ALIASES.tag_number),
      name: find(FIELD_ALIASES.name),
      equipment_type: find(FIELD_ALIASES.equipment_type),
      status: find(FIELD_ALIASES.status),
      criticality: find(FIELD_ALIASES.criticality),
      location: find(FIELD_ALIASES.location),
      area_id: find(FIELD_ALIASES.area_id),
      description: find(FIELD_ALIASES.description),
      parent_id: find(FIELD_ALIASES.parent_id),
    };
  }

  function buildImportRows(map: Record<keyof ImportRow, number>): {
    rows: ImportRow[];
    skipped: number;
  } {
    const out: ImportRow[] = [];
    let skipped = 0;
    for (const r of csvRows) {
      const tag = map.tag_number >= 0 ? (r[map.tag_number] || "").trim() : "";
      const name = map.name >= 0 ? (r[map.name] || "").trim() : "";
      if (!tag || !name) {
        skipped++;
        continue;
      }
      out.push({
        tag_number: tag,
        name,
        equipment_type: map.equipment_type >= 0 ? (r[map.equipment_type] || "").trim() || null : null,
        status: map.status >= 0 ? normalizeStatus(r[map.status]) : "Running",
        criticality: map.criticality >= 0 ? normalizeCriticality(r[map.criticality]) : "Medium",
        location: map.location >= 0 ? (r[map.location] || "").trim() || null : null,
        area_id: map.area_id >= 0 ? resolveArea((r[map.area_id] || "").trim()) : null,
        description: map.description >= 0 ? (r[map.description] || "").trim() || null : null,
        parent_id: map.parent_id >= 0 ? (r[map.parent_id] || "").trim() || null : null,
      });
    }
    return { rows: out, skipped };
  }

  function downloadTemplate() {
    exportToCsv("equipment_import_template", [], [
      { key: "tag_number", label: "Tag Number" },
      { key: "name", label: "Name" },
      { key: "equipment_type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "criticality", label: "Criticality" },
      { key: "location", label: "Location" },
      { key: "area_id", label: "Area" },
      { key: "description", label: "Description" },
      { key: "parent_id", label: "Parent ID" },
    ]);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error("Could not read the selected file");
      return;
    }

    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) {
      toast.error("The selected file has no header row");
      return;
    }

    setCsvHeaders(headers);
    setCsvRows(rows);
    setMapping(autoMap(headers));
    setMapOpen(true);
  }

  async function confirmImport() {
    const { rows, skipped } = buildImportRows(mapping);
    if (rows.length === 0) {
      toast.error("No valid rows — map Tag Number and Name, then try again.");
      return;
    }
    try {
      const count = await invoke<number>("import_equipment_csv", { rows });
      await loadEquipment();
      setMapOpen(false);
      toast.success(
        `Imported ${count} equipment record(s)${skipped ? `, ${skipped} skipped` : ""}`
      );
    } catch (err) {
      toast.error(`Import failed: ${err}`);
    }
  }

  function handleLookup() {
    const raw = lookupValue.trim();
    if (!raw) return;
    // Accept either a scanned QR payload (tpm-rca://equipment/<id>) or a plain tag number.
    const id = parseEquipmentQr(raw);
    let match: Equipment | undefined;
    if (id) match = equipment.find((eq) => eq.id === id);
    if (!match) {
      match = equipment.find(
        (eq) => (eq.tag_number || "").toLowerCase() === raw.toLowerCase()
      );
    }
    if (match) {
      setSelectedEquipment(match);
      setLookupOpen(false);
      setLookupValue("");
      toast.success(`Found ${match.tag_number || match.name}`);
    } else {
      toast.error("No equipment matches that code or tag");
    }
  }

  function handleEdit(eq: Equipment) {
    setForm({
      tag_number: eq.tag_number || "",
      name: eq.name || "",
      description: eq.description || "",
      location: eq.location || "",
      criticality: eq.criticality || "Medium",
      status: eq.status || "Running",
      equipment_type: eq.equipment_type || "",
      parent_id: eq.parent_id || "",
      area_id: eq.area_id || "",
    });
    setUi((prev) => ({ ...prev, editingId: eq.id, showForm: true }));
    setSelectedEquipment(null);
  }

  if (loading) {
    return <LoadingState label="Loading equipment..." />;
  }

  if (ui.error) {
    return <Banner tone="error">{ui.error}</Banner>;
  }

  if (selectedEquipment) {
    const eq = selectedEquipment;
    return (
      <div className="space-y-5 p-6 h-full overflow-y-auto">
        <button
          onClick={() => setSelectedEquipment(null)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Equipment
        </button>

        <Card className="!p-0 overflow-hidden">
          <div className="flex items-start justify-between gap-4 p-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center text-lg font-bold">
                {initialsOf(eq)}
              </div>
              <div>
                <p className="text-sm text-slate-500 font-mono">{eq.tag_number}</p>
                <h2 className="text-2xl font-bold text-slate-900">{eq.name}</h2>
              </div>
            </div>
            <div className="flex gap-2">
              <StatusBadge label={eq.status} kind="equipment" />
              <Badge className={getCriticalityColor(eq.criticality)}>
                {eq.criticality} Criticality
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 p-6">
            <Info label="Equipment Type" value={eq.equipment_type || "—"} />
            <Info label="Location" value={eq.location} />
            <Info label="Plant / Area" value={areaLabel(eq.area_id)} />
            <Info label="Parent Equipment" value={eq.parent_id} />
            <Info label="Created" value={eq.created_at} />
            <Info label="Updated" value={eq.updated_at} />
            <div className="col-span-2 md:col-span-3">
              <p className="text-sm text-slate-500">Description</p>
              <p className="font-medium mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">
                {eq.description || "—"}
              </p>
            </div>
            <div className="col-span-2 md:col-span-3 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500 mb-3">Asset QR Tag</p>
              <QrCode
                value={equipmentQrValue(eq.id, eq.tag_number)}
                downloadName={`equipment-${eq.tag_number || eq.id}`}
                label={eq.tag_number || eq.id}
              />
            </div>
          </div>

          {canEditEquipment && (
            <div className="flex gap-3 px-6 pb-6">
              <Button variant="edit" onClick={() => handleEdit(eq)}>
                <Pencil className="w-4 h-4" /> Edit Equipment
              </Button>
              <Button variant="danger" onClick={() => handleDelete(eq.id)}>
                <Trash2 className="w-4 h-4" /> Delete Equipment
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      {lookupOpen && (
        <Modal title="QR / Tag Lookup" onClose={() => setLookupOpen(false)} maxWidth="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Scan an asset QR tag and paste its contents here, or type an equipment tag number.
            </p>
            <Field label="Scanned code or tag number">
              <Input
                autoFocus
                placeholder="tpm-rca://equipment/…  or  PUMP-001"
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setLookupOpen(false)}>Cancel</Button>
              <Button onClick={handleLookup}>Find Equipment</Button>
            </div>
          </div>
        </Modal>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />

      {mapOpen && (
        <Modal title="Import Equipment from CSV" onClose={() => setMapOpen(false)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Match your CSV columns to the equipment fields. Tag Number and Name are required.
              {" "}
              <button type="button" className="text-blue-600 hover:underline" onClick={downloadTemplate}>
                Download a template
              </button>
            </p>

            <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
              {IMPORT_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {f.label}{f.required && <span className="text-rose-500"> *</span>}
                    </p>
                    {f.hint && <p className="text-[11px] text-slate-400">{f.hint}</p>}
                  </div>
                  <Select
                    value={mapping[f.key]}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                    className="flex-1"
                  >
                    <option value={-1}>— Ignore —</option>
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>{h || `(column ${i + 1})`}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            <div className="text-sm">
              {preview.rows.length === 0 ? (
                <p className="text-amber-600">
                  No rows will be imported yet — map Tag Number and Name to continue.
                </p>
              ) : (
                <p className="text-slate-500">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{preview.rows.length}</span> record(s) ready
                  {preview.skipped > 0 && (
                    <span className="text-amber-600"> · {preview.skipped} skipped (missing Tag/Name)</span>
                  )}
                </p>
              )}
            </div>

            <div className="max-h-44 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={thClass}>Tag</th>
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 30).map((r, i) => (
                    <tr key={i} className={trClass}>
                      <td className={`${tdClass} font-mono`}>{r.tag_number}</td>
                      <td className={tdClass}>{r.name}</td>
                      <td className={`${tdClass} text-slate-600`}>{r.equipment_type || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setMapOpen(false)}>Cancel</Button>
              <Button onClick={confirmImport} disabled={preview.rows.length === 0}>
                Import {preview.rows.length || ""}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <PageHeader
        title="Equipment Register"
        subtitle="Centralized industrial equipment management"
        actions={
          <>
            <LiveIndicator />
            <Button variant="secondary" onClick={() => setLookupOpen(true)}>
              <QrIcon className="w-4 h-4" /> QR Lookup
            </Button>
            {canEditEquipment && (
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Import CSV
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={!filteredEquipment.length}
              onClick={() => {
                exportToCsv("equipment", filteredEquipment, [
                  { key: "tag_number", label: "Tag Number" },
                  { key: "name", label: "Name" },
                  { key: "equipment_type", label: "Type" },
                  { key: "status", label: "Status" },
                  { key: "criticality", label: "Criticality" },
                  { key: "location", label: "Location" },
                  { key: "area_id", label: "Area", format: (v) => areaLabel(v as string | null) },
                  { key: "description", label: "Description" },
                  { key: "created_at", label: "Created At" },
                ]);
                toast.success(`Exported ${filteredEquipment.length} equipment records`);
              }}
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            {canEditEquipment && (
              <Button
                data-tour="add-equipment"
                onClick={() => { resetForm(); setUi((prev) => ({ ...prev, showForm: !prev.showForm })); }}
              >
                <Plus className="w-4 h-4" /> Add Equipment
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Layers className="w-5 h-5" />} tint="slate" label="Total Equipment" value={<span className="text-slate-900">{stats.total}</span>} />
        <StatCard icon={<Cog className="w-5 h-5" />} tint="emerald" label="Running" value={<span className="text-emerald-600">{stats.running}</span>} />
        <StatCard icon={<Cog className="w-5 h-5" />} tint="amber" label="Under Maintenance" value={<span className="text-amber-600">{stats.maintenance}</span>} />
        <StatCard icon={<Cog className="w-5 h-5" />} tint="rose" label="Failed" value={<span className="text-red-600">{stats.failed}</span>} />
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search equipment..."
              value={ui.search}
              onChange={(e) => setUi((prev) => ({ ...prev, search: e.target.value }))}
              className="pl-10"
            />
          </div>
          <Select value={ui.statusFilter} onChange={(e) => setUi((p) => ({ ...p, statusFilter: e.target.value }))}>
            <option value="">All Status</option>
            <option value="Running">Running</option>
            <option value="Standby">Standby</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Failed">Failed</option>
          </Select>
          <Select value={ui.criticalityFilter} onChange={(e) => setUi((p) => ({ ...p, criticalityFilter: e.target.value }))}>
            <option value="">All Criticality</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>
          <Select value={ui.typeFilter} onChange={(e) => setUi((p) => ({ ...p, typeFilter: e.target.value }))}>
            <option value="">All Types</option>
            {equipmentTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      </Card>

      {ui.showForm && canEditEquipment && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">{ui.editingId ? "Edit Equipment" : "Create Equipment"}</h3>
            <button onClick={() => setUi((prev) => ({ ...prev, showForm: false }))} className="text-slate-400 hover:text-slate-700 text-lg" aria-label="Close">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-5">
              <Field label="Tag Number"><Input placeholder="Tag Number" value={form.tag_number} onChange={(e) => setForm({ ...form, tag_number: e.target.value })} /></Field>
              <Field label="Equipment Name"><Input placeholder="Equipment Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Equipment Type"><Input placeholder="Equipment Type" value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} /></Field>
              <Field label="Location"><Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <Field label="Criticality">
                <Select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
                  <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>Running</option><option>Standby</option><option>Under Maintenance</option><option>Failed</option>
                </Select>
              </Field>
              <Field label="Plant / Area" className="col-span-2">
                <Select value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })}>
                  <option value="">No Area (unassigned)</option>
                  {plants.map((p) => (
                    <optgroup key={p.id} label={p.name || "Plant"}>
                      {areas.filter((a) => a.plant_id === p.id).map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Field label="Parent Equipment ID (optional)" className="col-span-2">
                <Input placeholder="Parent Equipment ID (optional)" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} />
              </Field>
              <Field label="Description" className="col-span-2">
                <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Button variant="primary" className="col-span-2" onClick={ui.editingId ? handleUpdate : handleCreate}>
                {ui.editingId ? "Update Equipment" : "Save Equipment"}
              </Button>
            </div>
        </Card>
      )}

      {filteredEquipment.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Cog className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-400 mb-2">No equipment found</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </Card>
      ) : (
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Equipment</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Location</th>
                <th className={thClass}>Area</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Criticality</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.map((eq) => (
                <tr key={eq.id} onClick={() => setSelectedEquipment(eq)} className={`${trClass} cursor-pointer`}>
                  <td className={tdClass}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 grid place-items-center text-xs font-bold shrink-0">
                        {initialsOf(eq)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{eq.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">{eq.tag_number} · {eq.description?.slice(0, 40) || "No description"}</p>
                      </div>
                    </div>
                  </td>
                  <td className={`${tdClass} text-slate-600`}>
                    {eq.equipment_type ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{eq.equipment_type}</span> : "—"}
                  </td>
                  <td className={`${tdClass} text-slate-600`}>{eq.location || "—"}</td>
                  <td className={`${tdClass} text-xs text-slate-500`}>{areaLabel(eq.area_id)}</td>
                  <td className={tdClass}><StatusBadge label={eq.status} kind="equipment" /></td>
                  <td className={tdClass}>
                    <Badge className={getCriticalityColor(eq.criticality)}>{eq.criticality}</Badge>
                  </td>
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {canEditEquipment ? (
                        <>
                          <Button size="sm" variant="edit" onClick={() => handleEdit(eq)}>Edit</Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(eq.id)}>Delete</Button>
                        </>
                      ) : <span className="text-xs text-slate-400">View only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}

export default EquipmentPage;
