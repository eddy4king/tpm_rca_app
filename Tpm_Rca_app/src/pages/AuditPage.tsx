import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  History, Search, User, CalendarDays, PlusCircle, Pencil, Trash2, CheckCircle2,
} from "lucide-react";
import { Chip } from "../components/indicators";
import {
  PageHeader, Card, Input, Select, TableCard, LoadingState, Banner, Badge,
  tableHeadClass, thClass, tdClass, trClass,
} from "../components/ui";

interface AuditLog {
  id: string; entity_type: string; entity_id: string | null; action: string;
  description: string | null; performed_by: string | null; created_at: string | null;
}

const ACTION_META: Record<string, { badge: string; icon: React.ReactNode }> = {
  create: { badge: "bg-green-100 text-green-700 border-green-200", icon: <PlusCircle className="w-3.5 h-3.5" /> },
  update: { badge: "bg-blue-100 text-blue-700 border-blue-200", icon: <Pencil className="w-3.5 h-3.5" /> },
  delete: { badge: "bg-red-100 text-red-700 border-red-200", icon: <Trash2 className="w-3.5 h-3.5" /> },
  close: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  complete: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

const ENTITY_TYPES = ["equipment", "downtime", "capa", "pm_schedule", "plant", "area", "user"];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await invoke<AuditLog[]>("get_audit_logs", {
        entityType: filterEntity || null,
        entityId: null,
        action: filterAction || null,
        limit: 1000,
      });
      setLogs(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterEntity, filterAction]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l =>
      !q || (l.description || "").toLowerCase().includes(q) ||
      (l.performed_by || "").toLowerCase().includes(q) ||
      (l.entity_id || "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  if (loading) return <LoadingState label="Loading audit trail…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="Audit Trail & History"
          subtitle="Immutable record of all create, update, close and delete actions"
          live
        />

        <Card className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input placeholder="Search description or user…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-10" />
            </div>
            <Select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
              <option value="">All Entity Types</option>
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="close">Close</option>
              <option value="complete">Complete</option>
              <option value="delete">Delete</option>
            </Select>
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-slate-500">
            <div>
              <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-lg font-semibold">No audit records found</p>
              <p className="text-sm mt-1">Actions on equipment, downtime, CAPA and PM tasks are logged automatically.</p>
            </div>
          </div>
        ) : (
          <TableCard>
            <table className="w-full">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Action</th>
                  <th className={thClass}>Entity</th>
                  <th className={thClass}>Description</th>
                  <th className={thClass}>Performed By</th>
                  <th className={thClass}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const meta = ACTION_META[l.action] || { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: null };
                  return (
                    <tr key={l.id} className={trClass}>
                      <td className={tdClass}>
                        <Badge className={`${meta.badge} capitalize`}>
                          {meta.icon}{l.action}
                        </Badge>
                      </td>
                      <td className={tdClass}>
                        <Chip className="bg-slate-100 text-slate-600 capitalize">{l.entity_type}</Chip>
                        {l.entity_id && <p className="text-xs text-slate-400 mt-1 font-mono truncate max-w-[140px]">{l.entity_id}</p>}
                      </td>
                      <td className={`${tdClass} text-sm text-slate-700`}>{l.description || "—"}</td>
                      <td className={tdClass}>
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {l.performed_by || "system"}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {l.created_at ? new Date(l.created_at).toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableCard>
        )}
      </div>
    </div>
  );
}
