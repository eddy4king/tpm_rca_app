import { useState } from "react";
import { Search, HelpCircle, RotateCcw } from "lucide-react";
import { Modal, Input, Button } from "./ui";
import { useTour } from "../context/TourContext";
import TourMascot from "./TourMascot";

interface Topic {
  group: string;
  title: string;
  body: string;
}

const TOPICS: Topic[] = [
  { group: "Getting started", title: "Welcome", body: "TPM-RCA is your single desktop hub for equipment, downtime, root-cause analysis and TPM activities." },
  { group: "Getting started", title: "Take the tour", body: "Replay the guided tour any time from this Help panel, or it auto-runs on first launch." },
  { group: "Getting started", title: "Navigation", body: "Use the left sidebar to switch modules. Your last open module is remembered between sessions." },
  { group: "Getting started", title: "Theme & language", body: "Toggle dark/light mode and switch the interface language from the sidebar footer." },

  { group: "Modules", title: "Dashboard", body: "Live KPIs: availability, MTTR, MTBF and open downtime, plus OEE and trend charts." },
  { group: "Modules", title: "Equipment", body: "The asset register. Add equipment, import a bulk CSV, scan QR tags to look up assets, and export reports." },
  { group: "Modules", title: "Hierarchy", body: "Organise plants, areas and parent/child equipment relationships." },
  { group: "Modules", title: "Downtime", body: "Log downtime events against equipment with cause, loss category and duration." },
  { group: "Modules", title: "RCA", body: "Run guided root-cause investigations and build cause-and-effect diagrams." },
  { group: "Modules", title: "CAPA", body: "Track corrective and preventive actions linked to investigations." },
  { group: "Modules", title: "PM Scheduler", body: "Schedule preventive maintenance, attach files and complete work with history." },
  { group: "Modules", title: "Tasks", body: "Personal and assigned maintenance tasks with due dates and status." },
  { group: "Modules", title: "Timeline", body: "A unified maintenance timeline across downtime, PM and RCA events." },
  { group: "Modules", title: "Audit", body: "An immutable log of who changed what, for traceability and compliance." },
  { group: "Modules", title: "Sync", body: "Back up and restore the local database, and sync with a central server when online." },
  { group: "Modules", title: "Users", body: "Admin-only user management: roles, permissions and password recovery." },

  { group: "Tips", title: "CSV import & export", body: "Export any filtered list to CSV; import equipment in bulk using the same column headers (a template is provided in the import dialog)." },
  { group: "Tips", title: "QR asset tags", body: "Each asset has a QR code you can print and scan to jump straight to its detail view." },
  { group: "Tips", title: "Offline-first", body: "The app works fully offline using a local database and queues changes to sync when a connection is available." },
  { group: "Tips", title: "Keyboard", body: "Press ? anywhere to open this help panel. Press Esc to close it." },
];

export default function HelpModal() {
  const { closeHelp, startTour } = useTour();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? TOPICS.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
      )
    : TOPICS;

  const groups = Array.from(new Set(filtered.map((t) => t.group)));

  return (
    <Modal title="Help & contextual guide" onClose={closeHelp} maxWidth="max-w-2xl">
      <div className="flex items-start gap-3 mb-4">
        <TourMascot size={48} />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hi, I'm <span className="font-semibold text-slate-700 dark:text-slate-200">Ruca</span> —
          your TPM-RCA guide. Search a topic below, or replay the tour anytime.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              autoFocus
              placeholder="Search help..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              closeHelp();
              startTour();
            }}
          >
            <RotateCcw className="w-4 h-4" /> Replay tour
          </Button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-5">
          {groups.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              No results for “{query}”.
            </p>
          )}
          {groups.map((group) => (
            <div key={group}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {group}
              </h4>
              <div className="space-y-2">
                {filtered
                  .filter((t) => t.group === group)
                  .map((t) => (
                    <div
                      key={t.title}
                      className="flex gap-3 rounded-xl border border-slate-100 dark:border-slate-700 p-3"
                    >
                      <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {t.title}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                          {t.body}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
