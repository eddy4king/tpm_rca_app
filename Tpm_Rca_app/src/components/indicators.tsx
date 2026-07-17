import { ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Real-time status indicators with consistent color coding.
 * These are reused by the Dashboard, Equipment, Hierarchy, Tasks,
 * Timeline and Audit pages so status colors stay uniform app-wide.
 * ------------------------------------------------------------------ */

export const EQUIPMENT_STATUS: Record<string, { dot: string; badge: string; live?: boolean }> = {
  Running: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", live: true },
  Standby: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  "Under Maintenance": { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Failed: { dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200", live: true },
};

export const DOWNTIME_STATUS: Record<string, { dot: string; badge: string }> = {
  Ongoing: { dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-700 border-red-200" },
  Closed: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export const PM_STATUS: Record<string, { dot: string; badge: string }> = {
  Pending: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Overdue: { dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-700 border-red-200" },
  Completed: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export const CAPA_STATUS: Record<string, { dot: string; badge: string }> = {
  Open: { dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-700 border-red-200" },
  "In Progress": { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Closed: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export const PRIORITY_META: Record<string, { dot: string; badge: string; rank: number }> = {
  Critical: { dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200", rank: 4 },
  High: { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200", rank: 3 },
  Medium: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200", rank: 2 },
  Low: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 border-slate-200", rank: 1 },
};

export function StatusDot({ color, live }: { color: string; live?: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${color} ${live ? "animate-pulse" : ""}`}
    />
  );
}

export function StatusBadge({ label, kind }: { label: string | null; kind: "equipment" | "downtime" | "pm" | "capa" }) {
  const map =
    kind === "equipment" ? EQUIPMENT_STATUS :
    kind === "downtime" ? DOWNTIME_STATUS :
    kind === "pm" ? PM_STATUS : CAPA_STATUS;

  const meta = (label && map[label]) || { badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${meta.badge}`}>
      <StatusDot color={meta.dot} live={meta.dot.includes("animate-pulse")} />
      {label || "Unknown"}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const p = (priority || "Medium") as string;
  const meta = PRIORITY_META[p] || PRIORITY_META.Medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${meta.badge}`}>
      <StatusDot color={meta.dot} />
      {p} Priority
    </span>
  );
}

/** A small "live" pill used in page headers to convey real-time data. */
export function LiveIndicator({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      {label}
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${className || "bg-slate-100 text-slate-600"}`}>
      {children}
    </span>
  );
}
