import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ListTodo, Search, AlertTriangle, CalendarClock,
} from "lucide-react";
import { StatusBadge, PriorityBadge, PRIORITY_META } from "../components/indicators";
import {
  PageHeader,
  Card,
  Input,
  Select,
  TableCard,
  LoadingState,
  Banner,
  tableHeadClass,
  thClass,
  tdClass,
  trClass,
} from "../components/ui";

interface Equipment { id: string; tag_number: string | null; name: string | null; }
interface CAPA {
  id: string; title: string | null; status: string | null; priority: string | null;
  due_date: string | null; owner: string | null; investigation_id: string | null;
}
interface PmSchedule {
  id: string; title: string | null; status: string | null; priority: string | null;
  next_due_date: string | null; assigned_to: string | null; equipment_id: string;
}

type TaskSource = "CAPA" | "PM";
interface Task {
  id: string; source: TaskSource; title: string; status: string; priority: string;
  dueDate: string | null; assignee: string | null; equipmentId: string | null; equipmentName: string;
  overdue: boolean;
}

const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export default function TasksPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [pms, setPms] = useState<PmSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterSource, setFilterSource] = useState<"" | TaskSource>("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [eq, c, p] = await Promise.all([
        invoke<Equipment[]>("get_all_equipment"),
        invoke<CAPA[]>("get_all_capas"),
        invoke<PmSchedule[]>("get_all_pm_schedules"),
      ]);
      setEquipment(eq); setCapas(c); setPms(p);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const eqName = useMemo(() => {
    const m = new Map<string, string>();
    equipment.forEach(e => m.set(e.id, `${e.tag_number} — ${e.name}`));
    return m;
  }, [equipment]);

  function pmStatus(pm: PmSchedule): { status: string; overdue: boolean } {
    if (pm.status === "Completed") return { status: "Completed", overdue: false };
    if (!pm.next_due_date) return { status: "Pending", overdue: false };
    const overdue = new Date(pm.next_due_date) < new Date();
    return { status: overdue ? "Overdue" : "Pending", overdue };
  }

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];
    capas.forEach(c => {
      const overdue = !!c.due_date && c.status !== "Closed" && new Date(c.due_date) < new Date();
      out.push({
        id: c.id, source: "CAPA", title: c.title || "Untitled CAPA",
        status: c.status || "Open", priority: c.priority || "Medium",
        dueDate: c.due_date, assignee: c.owner, equipmentId: null, equipmentName: "—",
        overdue,
      });
    });
    pms.forEach(p => {
      const { status, overdue } = pmStatus(p);
      out.push({
        id: p.id, source: "PM", title: p.title || "Untitled PM",
        status, priority: p.priority || "Medium",
        dueDate: p.next_due_date, assignee: p.assigned_to,
        equipmentId: p.equipment_id, equipmentName: eqName.get(p.equipment_id) || p.equipment_id,
        overdue,
      });
    });

    const q = search.toLowerCase();
    return out
      .filter(t => !filterPriority || t.priority === filterPriority)
      .filter(t => !filterSource || t.source === filterSource)
      .filter(t => !filterStatus || t.status === filterStatus)
      .filter(t => !filterEquipment || t.equipmentId === filterEquipment)
      .filter(t => !q || t.title.toLowerCase().includes(q) || t.equipmentName.toLowerCase().includes(q) || (t.assignee || "").toLowerCase().includes(q))
      .sort((a, b) => {
        const rank = (PRIORITY_META[b.priority]?.rank || 0) - (PRIORITY_META[a.priority]?.rank || 0);
        if (rank !== 0) return rank;
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
  }, [capas, pms, search, filterPriority, filterSource, filterStatus, filterEquipment, eqName]);

  const priorityCounts = useMemo(() => {
    const c: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    tasks.forEach(t => { c[t.priority] = (c[t.priority] || 0) + 1; });
    return c;
  }, [tasks]);

  const overdueCount = tasks.filter(t => t.overdue).length;

  if (loading) return <LoadingState label="Loading tasks…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="Task Management"
          subtitle="CAPA & Preventive Maintenance — prioritized by urgency"
          live
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
          {PRIORITIES.map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(filterPriority === p ? "" : p)}
              className={`text-left transition ${filterPriority === p ? "ring-2 ring-slate-400 border-slate-300" : ""}`}
            >
              <Card className="bg-white">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full border inline-block ${PRIORITY_META[p].badge}`}>{p}</span>
                <h2 className="text-3xl font-bold mt-1">{priorityCounts[p]}</h2>
              </Card>
            </button>
          ))}
          <Card className="bg-white">
            <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</p>
            <h2 className="text-3xl font-bold mt-1 text-red-600">{overdueCount}</h2>
          </Card>
        </div>

        <Card className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-3" />
            </div>
            <Select value={filterSource} onChange={e => setFilterSource(e.target.value as "" | TaskSource)}>
              <option value="">All Types</option>
              <option value="CAPA">CAPA</option>
              <option value="PM">PM</option>
            </Select>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Closed">Closed</option>
            </Select>
            <Select value={filterEquipment} onChange={e => setFilterEquipment(e.target.value)}>
              <option value="">All Equipment</option>
              {equipment.map(e => <option key={e.id} value={e.id}>{e.tag_number} — {e.name}</option>)}
            </Select>
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-slate-500">
            <div>
              <ListTodo className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-lg font-semibold">No tasks match your filters</p>
            </div>
          </div>
        ) : (
          <TableCard>
            <table className="w-full">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Priority</th>
                  <th className={thClass}>Task</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Equipment</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Assignee</th>
                  <th className={thClass}>Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={`${t.source}-${t.id}`} className={`${trClass} ${t.overdue ? "bg-red-50/40" : ""}`}>
                    <td className={tdClass}><PriorityBadge priority={t.priority} /></td>
                    <td className={tdClass}>
                      <p className="font-semibold text-slate-800">{t.title}</p>
                      {t.overdue && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${t.source === "CAPA" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-violet-100 text-violet-700 border-violet-200"}`}>{t.source}</span>
                    </td>
                    <td className={`${tdClass} text-sm text-slate-600`}>{t.equipmentName}</td>
                    <td className={tdClass}><StatusBadge label={t.status} kind={t.source === "CAPA" ? "capa" : "pm"} /></td>
                    <td className={`${tdClass} text-sm text-slate-600`}>{t.assignee || "—"}</td>
                    <td className={`${tdClass} text-sm`}>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </div>
    </div>
  );
}
