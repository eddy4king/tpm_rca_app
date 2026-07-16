import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search, Wrench, AlertOctagon, CheckCircle2, ClipboardCheck, Clock,
} from "lucide-react";
import { StatusBadge, PriorityBadge } from "../components/indicators";
import {
  PageHeader, Card, Input, Select, LoadingState, Banner, Badge,
} from "../components/ui";

interface Equipment { id: string; tag_number: string | null; name: string | null; }
interface TimelineEvent {
  id: string; event_type: string; title: string;
  equipment_id: string | null; equipment_name: string | null;
  timestamp: string | null; status: string | null; priority: string | null; meta: string | null;
}

const EVENT_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  downtime_start: { label: "Downtime Started", color: "text-red-700", bg: "bg-red-100 border border-red-200", icon: <AlertOctagon className="w-4 h-4" /> },
  downtime_end: { label: "Downtime Resolved", color: "text-green-700", bg: "bg-green-100 border border-green-200", icon: <CheckCircle2 className="w-4 h-4" /> },
  pm_complete: { label: "PM Completed", color: "text-emerald-700", bg: "bg-emerald-100 border border-emerald-200", icon: <Wrench className="w-4 h-4" /> },
  capa_created: { label: "CAPA Created", color: "text-blue-700", bg: "bg-blue-100 border border-blue-200", icon: <ClipboardCheck className="w-4 h-4" /> },
};

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [ev, eq] = await Promise.all([
        invoke<TimelineEvent[]>("get_maintenance_timeline", { equipmentId: null, limit: 1000 }),
        invoke<Equipment[]>("get_all_equipment"),
      ]);
      setEvents(ev); setEquipment(eq);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter(e =>
      (!filterType || e.event_type === filterType) &&
      (!filterEquipment || e.equipment_id === filterEquipment) &&
      (!q || e.title.toLowerCase().includes(q) || (e.equipment_name || "").toLowerCase().includes(q))
    );
  }, [events, search, filterType, filterEquipment]);

  if (loading) return <LoadingState label="Loading timeline…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="Maintenance Timeline"
          subtitle="Chronological history of downtime, PM and CAPA events"
          live
        />

        <Card className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Event Types</option>
              <option value="downtime_start">Downtime Started</option>
              <option value="downtime_end">Downtime Resolved</option>
              <option value="pm_complete">PM Completed</option>
              <option value="capa_created">CAPA Created</option>
            </Select>
            <Select value={filterEquipment} onChange={e => setFilterEquipment(e.target.value)}>
              <option value="">All Equipment</option>
              {equipment.map(e => <option key={e.id} value={e.id}>{e.tag_number} — {e.name}</option>)}
            </Select>
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-slate-500">
            <div>
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-lg font-semibold">No events found</p>
            </div>
          </div>
        ) : (
          <ol className="relative border-l-2 border-slate-200 ml-4 space-y-5">
            {filtered.map(ev => {
              const meta = EVENT_META[ev.event_type] || { label: ev.event_type, color: "text-slate-700", bg: "bg-slate-100 border border-slate-200", icon: <Clock className="w-4 h-4" /> };
              return (
                <li key={`${ev.event_type}-${ev.id}`} className="ml-6">
                  <span className={`absolute -left-[15px] flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-slate-100 ${meta.bg} ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <Badge className={`${meta.bg} ${meta.color} uppercase tracking-wide`}>{meta.label}</Badge>
                        <h3 className="font-bold text-slate-800 mt-0.5">{ev.title}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {ev.equipment_name ? `${ev.equipment_name}` : "No equipment"} {ev.meta ? `· ${ev.meta}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : "—"}
                        </span>
                        <div className="flex gap-2">
                          {ev.priority && <PriorityBadge priority={ev.priority} />}
                          {ev.status && <StatusBadge label={ev.status} kind={ev.event_type === "capa_created" ? "capa" : ev.event_type === "pm_complete" ? "pm" : "downtime"} />}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
