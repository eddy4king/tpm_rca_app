import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, Lightbulb, Plus, Wand2 } from "lucide-react";
import { Modal, Button, StatCard } from "./ui";
import TourMascot from "./TourMascot";
import { useToast } from "../context/ToastContext";
import type { RcaCoachReport } from "../lib/rcaCoach";

interface Props {
  equipmentId: string;
  investigationId: string | null;
  onSeeded: () => void;
  onClose: () => void;
}

export default function RcaCoach({
  equipmentId,
  investigationId,
  onSeeded,
  onClose,
}: Props) {
  const toast = useToast();
  const [report, setReport] = useState<RcaCoachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await invoke<RcaCoachReport>("rca_coach_report", { equipmentId });
        if (alive) setReport(r);
      } catch (err) {
        toast.error(`Coach failed: ${err}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [equipmentId]);

  async function addCapa(a: { title: string; description: string }) {
    if (!investigationId) {
      toast.error("Open or create an investigation first.");
      return;
    }
    try {
      await invoke("create_capa", {
        payload: {
          investigationId,
          title: a.title,
          owner: "RCA Coach",
          description: a.description || null,
          priority: "Medium",
          dueDate: null,
        },
      });
      toast.success(`Added CAPA: ${a.title}`);
    } catch (err) {
      toast.error(`Failed: ${err}`);
    }
  }

  async function seedTree() {
    if (!investigationId || !report) {
      toast.error("Open or create an investigation first.");
      return;
    }
    try {
      setSeeding(true);
      const problem = await invoke<{ id: string }>("add_rca_node", {
        payload: {
          investigationId,
          parentId: null,
          nodeType: "TopEvent",
          gateType: "OR",
          title: report.rca_seed.problem,
          description: null,
        },
      });
      for (const c of report.rca_seed.causes) {
        await invoke("add_rca_node", {
          payload: {
            investigationId,
            parentId: problem.id,
            nodeType: "BasicEvent",
            gateType: "OR",
            title: c,
            description: null,
          },
        });
      }
      for (const a of report.rca_seed.actions) {
        await invoke("create_capa", {
          payload: {
            investigationId,
            title: a,
            owner: "RCA Coach",
            description: null,
            priority: "Medium",
            dueDate: null,
          },
        });
      }
      toast.success("Seeded RCA tree from coach");
      onSeeded();
      onClose();
    } catch (err) {
      toast.error(`Seed failed: ${err}`);
    } finally {
      setSeeding(false);
    }
  }

  const noInv = !investigationId;

  return (
    <Modal title="RCA Coach — Ruca" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <TourMascot size={56} />
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Hi, I'm <span className="font-semibold text-slate-700 dark:text-slate-200">Ruca</span>.
            I analyzed this asset's downtime and past investigations and prepared a
            starting point for your root-cause analysis.
          </div>
        </div>

        {loading && <p className="text-sm text-slate-400">Analyzing history…</p>}

        {!loading && report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Downtime events" value={report.stats.downtime_count} />
              <StatCard label="Total downtime (min)" value={report.stats.total_minutes} />
              <StatCard label="Avg MTTR (min)" value={report.stats.avg_mttr} />
              <StatCard label="Recurring issues" value={report.stats.recurring_count} />
            </div>

            {!report.has_history && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
                No downtime or investigation history yet for this asset — suggestions are
                generic. They get smarter as data accumulates.
              </p>
            )}

            {report.top_loss_categories.length > 0 && (
              <Section title="Top loss categories">
                <div className="flex flex-wrap gap-2">
                  {report.top_loss_categories.map((c) => (
                    <span
                      key={c.category}
                      className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm"
                    >
                      {c.category} · {c.count}× · {c.minutes}m
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {report.recurring_failures.length > 0 && (
              <Section title="Recurring failures (same problem, repeated)">
                <ul className="space-y-1.5">
                  {report.recurring_failures.map((r) => (
                    <li key={r.signature} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Wand2 className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-100">{r.example}</span>
                      <span className="text-slate-400">— {r.count}×</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Suggested failure modes to explore">
              <div className="flex flex-wrap gap-2">
                {report.suggested_failure_modes.map((f, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-500/30 text-sm"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </Section>

            <Section title="Suggested corrective actions (CAPA)">
              <div className="space-y-2">
                {report.suggested_capa.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-700 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500" /> {a.title}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{a.description}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => addCapa(a)} disabled={noInv}>
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  </div>
                ))}
              </div>
              {noInv && (
                <p className="text-xs text-amber-600 mt-1">Open or create an investigation to add CAPA.</p>
              )}
            </Section>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={onClose}>Close</Button>
              <Button onClick={seedTree} disabled={noInv || seeding}>
                <Sparkles className="w-4 h-4" /> {seeding ? "Seeding…" : "Seed RCA tree"}
              </Button>
            </div>
            {noInv && (
              <p className="text-xs text-amber-600 text-right -mt-2">
                Open or create an investigation to seed the tree.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{title}</h4>
      {children}
    </div>
  );
}
