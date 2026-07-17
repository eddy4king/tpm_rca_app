import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageHeader, Card, LoadingState, Banner } from "../components/ui";
import { ClipboardList, CalendarClock } from "lucide-react";

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

export default function SchedulePage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [wos, setWos] = useState<Wo[]>([]);
  const [pms, setPms] = useState<Pm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        subtitle="PM due dates and work-order planning on a calendar"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">←</button>
            <span className="font-semibold text-slate-700 min-w-[140px] text-center">{MONTHS[cursor.m]} {cursor.y}</span>
            <button onClick={() => shift(1)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">→</button>
          </div>
        }
      />

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

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2"><ClipboardList className="w-4 h-4" /> Upcoming PM due ({pms.filter(p => p.next_due_date).length})</div>
          <p className="text-xs text-slate-400">Preventive maintenance due dates are shown on the calendar. Open the PM Scheduler to complete or reschedule.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2"><CalendarClock className="w-4 h-4" /> Work orders ({wos.length})</div>
          <p className="text-xs text-slate-400">Planned start and due dates surface here; click a chip to jump to Work Orders.</p>
        </Card>
      </div>
    </div>
  );
}
