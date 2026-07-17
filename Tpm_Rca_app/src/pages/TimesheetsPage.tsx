import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageHeader, Card, Input, Button, StatCard, TableCard, LoadingState, Banner, Field, tableHeadClass, thClass, tdClass, trClass } from "../components/ui";
import { Clock3, Download, Search } from "lucide-react";
import { exportToCsv } from "../lib/export";

interface TimesheetRow {
  id: string;
  person_name: string | null;
  minutes: number;
  rate: number | null;
  cost: number;
  note: string | null;
  created_at: string | null;
  wo_number: string;
  wo_title: string | null;
  wo_status: string | null;
}

export default function TimesheetsPage() {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoke<Record<string, unknown>[]>("get_timesheet_entries", {
        person: person || null,
        from: from || null,
        to: to || null,
      });
      setRows(data.map((r) => ({
        id: r.id as string,
        person_name: (r.person_name as string) ?? null,
        minutes: r.minutes as number,
        rate: (r.rate as number) ?? null,
        cost: r.cost as number,
        note: (r.note as string) ?? null,
        created_at: (r.created_at as string) ?? null,
        wo_number: r.wo_number as string,
        wo_title: (r.wo_title as string) ?? null,
        wo_status: (r.wo_status as string) ?? null,
      })));
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [person, from, to]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    entries: rows.length,
    hours: rows.reduce((a, r) => a + r.minutes / 60, 0),
    cost: rows.reduce((a, r) => a + r.cost, 0),
    people: new Set(rows.map((r) => r.person_name || "—")).size,
  }), [rows]);

  function handleExport() {
    exportToCsv("timesheets", rows, [
      { key: "created_at", label: "Date" },
      { key: "person_name", label: "Person" },
      { key: "wo_number", label: "WO #" },
      { key: "wo_title", label: "WO Title" },
      { key: "minutes", label: "Minutes" },
      { key: "rate", label: "Rate/hr" },
      { key: "cost", label: "Labor Cost" },
      { key: "note", label: "Note" },
    ]);
  }

  if (loading) return <LoadingState label="Loading timesheets…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Timesheets"
        subtitle="Labor captured against work orders"
        actions={<Button variant="secondary" onClick={handleExport} disabled={!rows.length}><Download className="w-4 h-4" /> Export CSV</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Clock3 className="w-5 h-5" />} tint="blue" label="Entries" value={<span className="text-blue-600">{stats.entries}</span>} />
        <StatCard icon={<Clock3 className="w-5 h-5" />} tint="slate" label="Total Hours" value={<span className="text-slate-900">{stats.hours.toFixed(1)}</span>} />
        <StatCard icon={<Clock3 className="w-5 h-5" />} tint="emerald" label="Labor Cost" value={<span className="text-emerald-600">${stats.cost.toFixed(2)}</span>} />
        <StatCard icon={<Clock3 className="w-5 h-5" />} tint="amber" label="People" value={<span className="text-amber-600">{stats.people}</span>} />
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input placeholder="Filter by person…" value={person} onChange={(e) => setPerson(e.target.value)} className="pl-10" />
          </div>
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Clock3 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-400 mb-2">No labor logged</p>
          <p className="text-sm">Add labor to a work order to see timesheets here.</p>
        </Card>
      ) : (
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Person</th>
                <th className={thClass}>Work Order</th>
                <th className={thClass}>Minutes</th>
                <th className={thClass}>Rate/hr</th>
                <th className={thClass}>Labor Cost</th>
                <th className={thClass}>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={trClass}>
                  <td className={`${tdClass} text-slate-600`}>{r.created_at?.slice(0, 10) || "—"}</td>
                  <td className={`${tdClass} font-medium text-slate-800`}>{r.person_name || "—"}</td>
                  <td className={tdClass}>
                    <span className="font-mono text-xs">{r.wo_number}</span>
                    <span className="block text-xs text-slate-400">{r.wo_title || ""}</span>
                  </td>
                  <td className={`${tdClass} text-slate-600`}>{r.minutes}</td>
                  <td className={`${tdClass} text-slate-600`}>{r.rate != null ? `$${r.rate}` : "—"}</td>
                  <td className={`${tdClass} font-semibold text-slate-800`}>${r.cost.toFixed(2)}</td>
                  <td className={`${tdClass} text-slate-600`}>{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
