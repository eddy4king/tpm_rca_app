import { useState, useEffect, useMemo } from "react";
import MTTRChart from "../components/MTTRChart";
import { OEEWidget } from "../components/OEEWidget";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  CheckCircle2,
  Clock3,
  TrendingDown,
  TrendingUp,
  Wrench,
  BarChart3,
  ClipboardCheck,
  AlertTriangle,
  Network,
  ListTodo,
  GitCommitVertical,
  History,
} from "lucide-react";
import { EQUIPMENT_STATUS } from "../components/indicators";
import {
  PageHeader,
  Card,
  LoadingState,
  Banner,
} from "../components/ui";

interface NavigateFn { (p: string): void; }

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
  status: string | null;
  criticality: string | null;
}

interface Downtime {
  id: string;
  equipment_id: string;
  title: string | null;
  loss_category: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  created_at: string | null;
}

interface Investigation {
  id: string;
  equipment_id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
}

interface CAPA {
  id: string;
  investigation_id: string | null;
  title: string | null;
  owner: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string | null;
}


const statusDot: Record<string, string> = {
  Running: "bg-emerald-500",
  Failed: "bg-red-500",
  Maintenance: "bg-amber-500",
  Standby: "bg-blue-500",
};

function KpiCard({
  label, value, unit, icon, color, sub, accent, tint,
}: {
  label: string; value: string | number; unit?: string;
  icon: React.ReactNode; color: string; sub?: string;
  accent?: string; tint?: string;
}) {
  return (
    <Card className={`${accent ? `border-l-4 ${accent}` : ""} ${tint || ""}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
      </div>
      <div className="flex items-end gap-1">
        <h2 className="text-3xl font-bold text-slate-900">{value}</h2>
        {unit && <span className="text-sm text-slate-500 mb-1">{unit}</span>}
      </div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </Card>
  );
}

function BarChart({ data, label }: { data: { name: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>
      <div className="space-y-3">
        {data.map(d => (
          <div key={d.name}>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>{d.name}</span>
              <span className="font-semibold">{d.value}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage({ onNavigate }: { onNavigate: NavigateFn }) { // Dashboard renders role‑specific widgets
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [downtime, setDowntime] = useState<Downtime[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]); // CAPA data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [eq, dt, capasData] = await Promise.all([
        invoke<Equipment[]>("get_all_equipment"),
        invoke<Downtime[]>("get_all_downtime"),
        invoke<CAPA[]>("get_all_capas"),
      ]);
      setEquipment(eq);
      setDowntime(dt);
      setCapas(capasData);
      if (eq.length > 0) {
        setSelectedEquipmentId(eq[0].id);
        const inv = await invoke<Investigation[]>("get_investigations", { equipmentId: eq[0].id });
        setInvestigations(inv);
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
      setSelectedEquipmentId(equipmentId);
    } catch (err) {
      setError(String(err));
    }
  }

  const filteredDowntime = useMemo(() =>
    selectedEquipmentId ? downtime.filter(d => d.equipment_id === selectedEquipmentId) : downtime,
    [downtime, selectedEquipmentId]
  );

  const metrics = useMemo(() => {
    const closed = filteredDowntime.filter(d => d.end_time && d.duration_minutes);
    const ongoing = filteredDowntime.filter(d => !d.end_time);

    // MTTR — average repair time of closed events
    const mttr = closed.length > 0
      ? Math.round(closed.reduce((acc, d) => acc + (d.duration_minutes || 0), 0) / closed.length)
      : 0;

    // MTBF — average time between failures in hours
    const sorted = [...filteredDowntime].sort((a, b) =>
      new Date(a.start_time || "").getTime() - new Date(b.start_time || "").getTime()
    );
    let mtbf = 0;
    if (sorted.length > 1) {
      let totalGap = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].start_time || "").getTime();
        const curr = new Date(sorted[i].start_time || "").getTime();
        totalGap += (curr - prev) / 60000; // in minutes
      }
      mtbf = Math.round(totalGap / (sorted.length - 1) / 60); // in hours
    }

    // Total downtime minutes
    const totalDowntimeMin = filteredDowntime.reduce((acc, d) => acc + (d.duration_minutes || 0), 0);

    // Availability — (planned time - downtime) / planned time * 100
    // Using 30 days * 24 hours * 60 min as planned time
    const plannedMinutes = 30 * 24 * 60;
    const availability = Math.min(100, Math.round(((plannedMinutes - totalDowntimeMin) / plannedMinutes) * 100));

    // Loss category breakdown
    const categories = ["Breakdown", "Setup", "Minor Stoppage", "Speed Loss"];
    const categoryData = categories.map(cat => ({
      name: cat,
      value: filteredDowntime.filter(d => d.loss_category === cat).length,
      color: cat === "Breakdown" ? "#ef4444" : cat === "Setup" ? "#f59e0b" : cat === "Minor Stoppage" ? "#f97316" : "#3b82f6",
    }));

    return { mttr, mtbf, availability, totalDowntimeMin, ongoing: ongoing.length, closed: closed.length, categoryData };
  }, [filteredDowntime]);

  const capaMetrics = useMemo(() => {
    const open = capas.filter(c => c.status === "Open").length;
    const inProgress = capas.filter(c => c.status === "In Progress").length;
    const closed = capas.filter(c => c.status === "Closed").length;
    const critical = capas.filter(c => c.priority === "Critical" && c.status !== "Closed").length;
    const overdue = capas.filter(c => {
      if (!c.due_date || c.status === "Closed") return false;
      return new Date(c.due_date) < new Date();
    }).length;
    const priorityData = [
      { name: "Critical", value: capas.filter(c => c.priority === "Critical").length, color: "#ef4444" },
      { name: "High", value: capas.filter(c => c.priority === "High").length, color: "#f97316" },
      { name: "Medium", value: capas.filter(c => c.priority === "Medium").length, color: "#3b82f6" },
      { name: "Low", value: capas.filter(c => c.priority === "Low").length, color: "#94a3b8" },
    ];
    return { open, inProgress, closed, critical, overdue, priorityData };
  }, [capas]);

  const equipmentHealth = useMemo(() => {
    return equipment.map(eq => {
      const eqDowntime = downtime.filter(d => d.equipment_id === eq.id);
      const openDowntime = eqDowntime.filter(d => !d.end_time).length;
      const totalEvents = eqDowntime.length;
      return { ...eq, openDowntime, totalEvents };
    }).sort((a, b) => b.openDowntime - a.openDowntime);
  }, [equipment, downtime]);

  if (loading) return <LoadingState label="Loading Dashboard..." />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="bg-slate-50 text-slate-800 overflow-y-auto" style={{ height: "100%" }}>
      <div className="px-6 py-5">

        {/* HEADER */}
        <PageHeader
          title="TPM Dashboard"
          subtitle="Total Productive Maintenance — Live Plant Overview"
          live
          actions={
            <select
              value={selectedEquipmentId}
              onChange={e => { setSelectedEquipmentId(e.target.value); loadInvestigations(e.target.value); }}
              className="border border-slate-300 rounded-xl px-4 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </select>
          }
        />
          {/* OEE Widget */}
          <div className="mb-6">
            <OEEWidget />
          </div>

        {/* TOP KPI ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Availability"
            value={metrics.availability}
            unit="%"
            icon={<Activity className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
            accent="border-emerald-500"
            sub="Last 30 days"
          />
          <KpiCard
            label="MTTR"
            value={metrics.mttr}
            unit="min"
            icon={<Wrench className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50"
            accent="border-blue-500"
            sub="Mean Time To Repair"
          />
          <KpiCard
            label="MTBF"
            value={metrics.mtbf}
            unit="hrs"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50"
            accent="border-blue-500"
            sub="Mean Time Between Failures"
          />
          <KpiCard
            label="Open Downtime"
            value={metrics.ongoing}
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            color="bg-red-50"
            accent="border-red-500"
            sub={`${metrics.closed} resolved`}
          />
        </div>

        {/* SECOND ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Total Downtime"
            value={metrics.totalDowntimeMin}
            unit="min"
            icon={<Clock3 className="w-5 h-5 text-amber-600" />}
            color="bg-amber-50"
            accent="border-amber-500"
            sub="All logged events"
          />
          <KpiCard
            label="Open CAPAs"
            value={capaMetrics.open + capaMetrics.inProgress}
            icon={<ClipboardCheck className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50"
            accent="border-blue-500"
            sub={`${capaMetrics.closed} closed`}
          />
          <KpiCard
            label="Critical CAPAs"
            value={capaMetrics.critical}
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            color="bg-red-50"
            accent="border-red-500"
            sub="Unresolved critical actions"
          />
          <KpiCard
            label="Overdue CAPAs"
            value={capaMetrics.overdue}
            icon={<TrendingDown className="w-5 h-5 text-orange-600" />}
            color="bg-orange-50"
            accent="border-orange-500"
            sub="Past due date"
          />
        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">Downtime by Loss Category</h3>
            </div>
            <BarChart data={metrics.categoryData} label="Events per category" />
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">MTTR Trend (last 7 days)</h3>
            </div>
            <MTTRChart data={Array.from({ length: 7 }, (_, i) => ({ date: `Day ${i + 1}`, mttr: metrics.mttr }))} />
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">CAPA by Priority</h3>
            </div>
            <BarChart data={capaMetrics.priorityData} label="Actions per priority level" />
          </Card>
        </div>

        {/* REAL-TIME STATUS + QUICK ACCESS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <Card>
            <h3 className="font-bold text-slate-800 mb-4">Live Equipment Status</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(EQUIPMENT_STATUS).map(([label, meta]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} ${meta.live ? "animate-pulse" : ""}`} />
                  <span className="text-sm text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="md:col-span-2">
            <h3 className="font-bold text-slate-800 mb-4">Quick Access</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickLink icon={<Network className="w-5 h-5" />} label="Hierarchy" onClick={() => onNavigate("hierarchy")} />
              <QuickLink icon={<ListTodo className="w-5 h-5" />} label="Tasks" onClick={() => onNavigate("tasks")} />
              <QuickLink icon={<GitCommitVertical className="w-5 h-5" />} label="Timeline" onClick={() => onNavigate("timeline")} />
              <QuickLink icon={<History className="w-5 h-5" />} label="Audit" onClick={() => onNavigate("audit")} />
            </div>
          </Card>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* EQUIPMENT HEALTH */}
          <Card>
            <h3 className="font-bold text-slate-800 mb-4">Equipment Health Overview</h3>
            <div className="space-y-3">
              {equipmentHealth.slice(0, 6).map(eq => (
                <div key={eq.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusDot[eq.status || ""] || "bg-slate-400"} ${eq.status === "Failed" ? "animate-pulse" : ""}`}></span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{eq.tag_number} — {eq.name}</p>
                      <p className="text-xs text-slate-400">{eq.criticality} criticality</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${eq.openDowntime > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {eq.openDowntime > 0 ? `${eq.openDowntime} open` : "OK"}
                    </p>
                    <p className="text-xs text-slate-400">{eq.totalEvents} total events</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* OPEN INVESTIGATIONS */}
          <Card>
            <h3 className="font-bold text-slate-800 mb-4">Open RCA Investigations</h3>
            {investigations.filter(i => i.status !== "Closed").length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No open investigations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {investigations.filter(i => i.status !== "Closed").slice(0, 5).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{inv.title}</p>
                      <p className="text-xs text-slate-400">{inv.created_at?.slice(0, 10)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      inv.status === "In Progress" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200"
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}

export default DashboardPage;

function QuickLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-2xl py-4 transition-colors duration-150 text-slate-600 hover:text-blue-700"
    >
      <span className="text-blue-600">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
