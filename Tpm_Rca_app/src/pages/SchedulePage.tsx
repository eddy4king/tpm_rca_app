import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageHeader, Card, LoadingState, Banner } from "../components/ui";
import { ClipboardList, CalendarClock, GanttChartSquare, CalendarDays } from "lucide-react";

interface Wo { id: string; wo_number: string; title: string; planned_start: string | null; due_date: string | null; status: string; }
interface Pm { id: string; title: string | null; next_due_date: string | null; equipment_id: string; }

interface CalEvent {
  id: string;
  date: string;        // YYYY-MM-DD
  title: string;
  kind: "pm" | "wo_planned" | "wo_due";
  target: "workorders" | "pm";
}

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  pm: "bg-amber-100 text-amber-700 border-amber-200",
  wo_planned: "bg-blue-100 text-blue-700 border-blue-200",
  wo_due: "bg-rose-100 text-rose-700 border-rose-200",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const GANTT_WEEKS = 12;
const DAY_MS = 86400000;

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? null : d;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

interface GanttItem {
  id: string;
  label: string;
  kind: "pm" | "wo";
  startIdx: number;   // day index within the gantt window
  endIdx: number;     // inclusive
  clampedLeft: boolean;
  clampedRight: boolean;
  target: "workorders" | "pm";
}

function GanttView({ wos, pms, onNavigate }: { wos: Wo[]; pms: Pm[]; onNavigate: (p: string) => void }) {
  const windowStart = useMemo(() => startOfWeek(new Date()), []);
  const totalDays = GANTT_WEEKS * 7;

  const items = useMemo<GanttItem[]>(() => {
    const out: GanttItem[] = [];
    const toIdx = (d: Date) => Math.floor((d.getTime() - windowStart.getTime()) / DAY_MS);
    for (const pm of pms) {
      const due = parseDate(pm.next_due_date);
      if (!due) continue;
      const idx = toIdx(due);
      out.push({
        id: `pm-${pm.id}`,
        label: `PM: ${pm.title || "task"}`,
        kind: "pm",
        startIdx: idx,
        endIdx: idx,
        clampedLeft: idx < 0,
        clampedRight: idx > totalDays,
        target: "pm",
      });
    }
    for (const w of wos) {
      const ps = parseDate(w.planned_start);
      const due = parseDate(w.due_date);
      if (!ps && !due) continue;
      const sIdx = ps ? toIdx(ps) : due ? toIdx(due) : 0;
      const eIdx = due ? toIdx(due) : ps ? toIdx(ps) : sIdx;
      out.push({
        id: `wo-${w.id}`,
        label: `${w.wo_number} — ${w.title}`,
        kind: "wo",
        startIdx: sIdx,
        endIdx: eIdx,
        clampedLeft: sIdx < 0,
        clampedRight: eIdx > totalDays,
        target: "workorders",
      });
    }
    return out.sort((a, b) => a.startIdx - b.startIdx);
  }, [wos, pms, windowStart]);

  const weeks = useMemo(() => {
    return Array.from({ length: GANTT_WEEKS }, (_, i) => {
      const d = new Date(windowStart.getTime() + i * 7 * DAY_MS);
      return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    });
  }, [windowStart]);

  const pct = (idx: number) => `${Math.max(0, Math.min(totalDays, idx)) / totalDays * 100}%`;
  const widthPct = (s: number, e: number) =>
    `${Math.max(1.5, (Math.min(totalDays, e) - Math.max(0, s)) / totalDays * 100)}%`;

  const barColor = (it: GanttItem) =>
    it.kind === "pm" ? "bg-amber-500" : "bg-blue-500";

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex">
        {/* Left label column */}
        <div className="w-56 shrink-0 border-r border-slate-100 bg-slate-50">
          <div className="h-9 px-3 flex items-center text-xs font-semibold text-slate-500 border-b border-slate-100">
            {items.length} scheduled items
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => onNavigate(it.target)}
                title={it.label}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 border-b border-slate-100 hover:bg-white truncate flex items-center gap-2"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${barColor(it)}`} />
                <span className="truncate">{it.label}</span>
              </button>
            ))}
            {items.length === 0 && (
              <p className="text-xs text-slate-400 p-3">No scheduled items with dates.</p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[840px]">
            {/* Week header */}
            <div className="flex h-9 border-b border-slate-100">
              {weeks.map((w, i) => (
                <div key={i} className="flex-1 px-2 py-1 text-[11px] font-medium text-slate-500 border-l border-slate-100 first:border-l-0">
                  {w}
                </div>
              ))}
            </div>
            {/* Rows */}
            <div className="max-h-[60vh] overflow-y-auto relative">
              {/* week gridlines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {weeks.map((_, i) => (
                  <div key={i} className="flex-1 border-l border-slate-100 first:border-l-0" />
                ))}
              </div>
              {items.map((it) => {
                const isRange = it.endIdx > it.startIdx;
                return (
                  <div key={it.id} className="relative h-9 border-b border-slate-100">
                    {isRange ? (
                      <button
                        onClick={() => onNavigate(it.target)}
                        title={it.label}
                        style={{ left: pct(it.startIdx), width: widthPct(it.startIdx, it.endIdx) }}
                        className={`absolute top-1.5 h-6 rounded-md ${barColor(it)} text-white text-[11px] flex items-center px-2 overflow-hidden hover:opacity-90`}
                      >
                        <span className="truncate">{it.label}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate(it.target)}
                        title={it.label}
                        style={{ left: pct(it.startIdx) }}
                        className={`absolute top-1.5 -translate-x-1/2 px-2 h-6 rounded-md ${barColor(it)} text-white text-[11px] flex items-center hover:opacity-90 whitespace-nowrap`}
                      >
                        {it.label}
                      </button>
                    )}
                    {it.clampedLeft && <span className="absolute left-0 top-2 text-[10px] text-amber-600">◀</span>}
                    {it.clampedRight && <span className="absolute right-0 top-2 text-[10px] text-amber-600">▶</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SchedulePage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [wos, setWos] = useState<Wo[]>([]);
  const [pms, setPms] = useState<Pm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "gantt">("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [w, p] = await Promise.all([
        invoke<Wo[]>("get_wos"),
        invoke<Pm[]>("get_all_pm_schedules"),
      ]);
      setWos(w);
      setPms(p);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const events = useMemo<Record<string, CalEvent[]>>(() => {
    const map: Record<string, CalEvent[]> = {};
    const push = (e: CalEvent) => { (map[e.date] ||= []).push(e); };
    for (const pm of pms) {
      if (pm.next_due_date) push({ id: `pm-${pm.id}`, date: pm.next_due_date.slice(0, 10), title: `PM: ${pm.title || "task"}`, kind: "pm", target: "pm" });
    }
    for (const w of wos) {
      if (w.planned_start) push({ id: `wp-${w.id}`, date: w.planned_start.slice(0, 10), title: `${w.wo_number} (plan)`, kind: "wo_planned", target: "workorders" });
      if (w.due_date) push({ id: `wd-${w.id}`, date: w.due_date.slice(0, 10), title: `${w.wo_number} (due)`, kind: "wo_due", target: "workorders" });
    }
    return map;
  }, [wos, pms]);

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  function ymd(day: number) {
    const mm = String(cursor.m + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${cursor.y}-${mm}-${dd}`;
  }

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.m + delta;
      const y = c.y + Math.floor(m / 12);
      const nm = ((m % 12) + 12) % 12;
      return { y, m: nm };
    });
  }

  if (loading) return <LoadingState label="Loading schedule…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Schedule"
        subtitle="PM due dates and work-order planning"
        actions={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setView("calendar")}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === "calendar" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <CalendarDays className="w-4 h-4" /> Calendar
              </button>
              <button
                onClick={() => setView("gantt")}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === "gantt" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <GanttChartSquare className="w-4 h-4" /> Gantt
              </button>
            </div>
            {view === "calendar" && (
              <div className="flex items-center gap-2">
                <button onClick={() => shift(-1)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">←</button>
                <span className="font-semibold text-slate-700 min-w-[140px] text-center">{MONTHS[cursor.m]} {cursor.y}</span>
                <button onClick={() => shift(1)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">→</button>
              </div>
            )}
          </div>
        }
      />

      {view === "calendar" ? (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200"></span> PM due</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200"></span> WO planned</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-200"></span> WO due</span>
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-900 text-white text-sm">
              {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center font-medium">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 border-t border-slate-100">
              {grid.map((day, i) => {
                if (day === null) return <div key={i} className="min-h-[92px] bg-slate-50/50 border-r border-b border-slate-100" />;
                const key = ymd(day);
                const dayEvents = events[key] || [];
                return (
                  <div key={i} className="min-h-[92px] p-1.5 border-r border-b border-slate-100 align-top">
                    <p className="text-xs text-slate-400 mb-1">{day}</p>
                    <div className="space-y-1">
                      {dayEvents.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => onNavigate(e.target)}
                          title={e.title}
                          className={`w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded border truncate ${KIND_STYLE[e.kind]}`}
                        >
                          {e.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <GanttView wos={wos} pms={pms} onNavigate={onNavigate} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2"><ClipboardList className="w-4 h-4" /> Upcoming PM due ({pms.filter(p => p.next_due_date).length})</div>
          <p className="text-xs text-slate-400">Preventive maintenance due dates are shown on the schedule. Open the PM Scheduler to complete or reschedule.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2"><CalendarClock className="w-4 h-4" /> Work orders ({wos.length})</div>
          <p className="text-xs text-slate-400">Planned start and due dates surface here; click a chip to jump to Work Orders.</p>
        </Card>
      </div>
    </div>
  );
}
