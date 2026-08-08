import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  PageHeader, Card, Button, Input, Textarea, Select, Modal, Badge, Field,
  LoadingState, Banner,
} from "../components/ui";
import { Lightbulb, Trophy, BarChart3, ThumbsUp, Plus, Trash2, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Kaizen {
  id: string;
  title: string;
  description: string | null;
  submitted_by: string | null;
  area_id: string | null;
  status: string;
  votes: number;
  implemented_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Area { id: string; name: string | null; plant_id: string; }
interface LeaderRow { id: string; name: string | null; oee: number; availability: number; downtime_min: number; equipment_count: number; }

const STATUSES = ["Submitted", "Under Review", "Approved", "Implemented", "Rejected"] as const;
type Status = typeof STATUSES[number];

const STATUS_COLOR: Record<string, string> = {
  "Submitted": "bg-slate-100 text-slate-700",
  "Under Review": "bg-amber-100 text-amber-700",
  "Approved": "bg-sky-100 text-sky-700",
  "Implemented": "bg-emerald-100 text-emerald-700",
  "Rejected": "bg-rose-100 text-rose-700",
};

export default function KaizenPage() {
  const { canEdit } = useAuth();
  const canManage = canEdit("Engineer");
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [items, setItems] = useState<Kaizen[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "All">("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", areaId: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [lb, ks, ar] = await Promise.all([
        invoke<LeaderRow[]>("get_oee_leaderboard"),
        invoke<Kaizen[]>("list_kaizen"),
        invoke<Area[]>("get_all_areas"),
      ]);
      setLeaderboard(lb);
      setItems(ks);
      setAreas(ar);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const areaName = (id: string | null) =>
    id ? (areas.find((a) => a.id === id)?.name ?? "—") : "—";

  const filtered = useMemo(
    () => (filter === "All" ? items : items.filter((k) => k.status === filter)),
    [items, filter]
  );

  // Operator recognition: count implemented suggestions per submitter.
  const topContributors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of items) {
      if (k.status === "Implemented" && k.submitted_by) {
        counts.set(k.submitted_by, (counts.get(k.submitted_by) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [items]);

  async function handleCreate() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    try {
      await invoke("create_kaizen", {
        payload: {
          title: form.title,
          description: form.description || null,
          areaId: form.areaId || null,
        },
      });
      setShowForm(false);
      setForm({ title: "", description: "", areaId: "" });
      load();
    } catch (err) { setError(String(err)); }
  }

  async function handleVote(id: string) {
    try { await invoke("vote_kaizen", { id }); load(); } catch (err) { setError(String(err)); }
  }

  async function handleStatus(id: string, status: string) {
    try { await invoke("set_kaizen_status", { payload: { id, status } }); load(); }
    catch (err) { setError(String(err)); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this suggestion?")) return;
    try { await invoke("delete_kaizen", { id }); load(); } catch (err) { setError(String(err)); }
  }

  if (loading) return <LoadingState label="Loading continuous improvement…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Continuous Improvement"
        subtitle="OEE leaderboards, Kaizen/CIP suggestions and operator recognition"
        actions={canManage ? <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Suggestion</Button> : undefined}
      />

      {/* OEE Leaderboard */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-slate-800">OEE Leaderboard by Line</h3>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-slate-400">No lines with equipment yet. Add equipment to an area to see rankings.</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3">
                <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 truncate">{row.name}</span>
                    <span className="text-slate-500">{row.oee}% <span className="text-xs text-slate-400">· {row.equipment_count} assets</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                      style={{ width: `${Math.max(2, row.oee)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Operator recognition */}
      {topContributors.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-800">Top Contributors</h3>
            <span className="text-xs text-slate-400">implemented suggestions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {topContributors.map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200">
                <Trophy className="w-3.5 h-3.5" /> {name} · {count}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Kaizen board */}
      <div className="flex flex-wrap items-center gap-2">
        {(["All", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${filter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Lightbulb className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-400 mb-1">No suggestions</p>
          <p className="text-sm">{filter === "All" ? "Submit the first Kaizen idea to get started." : `No suggestions in "${filter}".`}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((k) => (
            <Card key={k.id} className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{k.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Line: {areaName(k.area_id)} · by {k.submitted_by || "anonymous"}</p>
                </div>
                <Badge className={STATUS_COLOR[k.status] || "bg-slate-100 text-slate-700"}>{k.status}</Badge>
              </div>
              {k.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{k.description}</p>}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <Button size="sm" variant="secondary" onClick={() => handleVote(k.id)}>
                  <ThumbsUp className="w-3.5 h-3.5" /> {k.votes}
                </Button>
                {canManage && (
                  <>
                    <Select
                      value={k.status}
                      onChange={(e) => handleStatus(k.id, e.target.value)}
                      className="text-xs py-1.5"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    {k.status !== "Implemented" && k.status !== "Rejected" && (
                      <Button size="sm" variant="secondary" onClick={() => handleStatus(k.id, "Implemented")}>
                        <ArrowRight className="w-3.5 h-3.5" /> Implement
                      </Button>
                    )}
                    <button onClick={() => handleDelete(k.id)} className="ml-auto p-1.5 text-slate-400 hover:text-rose-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="New Kaizen / CIP Suggestion" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Field label="Title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short improvement idea" />
            </Field>
            <Field label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What, why, and expected benefit…" rows={4} />
            </Field>
            <Field label="Line / Area">
              <Select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                <option value="">— none —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Submit</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
