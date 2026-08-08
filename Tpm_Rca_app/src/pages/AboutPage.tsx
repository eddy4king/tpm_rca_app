import { PageHeader, Card, Button } from "../components/ui";
import {
  Monitor, Database, Boxes, CloudUpload, Radio, Mic, Wifi, QrCode,
  Cpu, Layers, HardDrive, BookOpen, Activity, Workflow, Gauge,
} from "lucide-react";

interface Layer {
  icon: typeof Cpu;
  title: string;
  detail: string;
}

const LAYERS: Layer[] = [
  {
    icon: Monitor,
    title: "Desktop shell (Tauri)",
    detail:
      "The app is a native desktop application built with Tauri. A thin Rust backend wraps a fast system webview — no bundled browser, so the install is small and it launches like any other desktop tool.",
  },
  {
    icon: Layers,
    title: "Frontend (React + TypeScript)",
    detail:
      "Every screen you see is a React + TypeScript single-page app bundled with Vite. Routing, theming, language and the guided tour all live here in the browser layer.",
  },
  {
    icon: Cpu,
    title: "Backend commands (Rust)",
    detail:
      "Business logic runs in Rust. The frontend calls backend commands (e.g. create_downtime, sync_to_postgres) through Tauri's secure bridge. Rust owns all data access and permission checks, so the UI never talks to the database directly.",
  },
  {
    icon: Database,
    title: "Local database (SQLite)",
    detail:
      "All your data is stored in a local SQLite file on this machine. This is what makes the app fully offline-first: it keeps working with no network, and the file is portable for backup and restore.",
  },
  {
    icon: CloudUpload,
    title: "Sync engine",
    detail:
      "When a connection is available you can sync the local SQLite database to a central PostgreSQL server, or reconcile with another install on the LAN (peer snapshot export/merge) — all without a server in the middle.",
  },
];

const STEPS = [
  {
    icon: Boxes,
    title: "Start here: Equipment",
    detail: "Add assets, import them in bulk via CSV, or print/scan QR tags to look them up on the floor.",
  },
  {
    icon: Activity,
    title: "Log downtime",
    detail: "Record downtime events by equipment, loss category and duration — by hand, by voice, or from a scanned tag.",
  },
  {
    icon: Workflow,
    title: "Investigate (RCA) & CAPA",
    detail: "Build cause-and-effect diagrams to find root cause, then track corrective actions to closure.",
  },
  {
    icon: Gauge,
    title: "Measure & improve",
    detail: "Watch the Dashboard KPIs (OEE, MTTR, MTBF) and FMEA/CBM analytics to drive reliability gains.",
  },
];

const CAPTURE = [
  { icon: Mic, label: "Voice", detail: "Dictate titles and descriptions with the Web Speech API." },
  { icon: Wifi, label: "NFC", detail: "Tap a physical NFC tag on supported mobile Chromium devices." },
  { icon: QrCode, label: "QR (camera + paste)", detail: "Point the camera at a QR tag, or paste its value." },
  { icon: HardDrive, label: "Offline drafts", detail: "Save entries locally and submit later, with no connection." },
];

function AboutPage() {
  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="About & How It Runs"
        subtitle="A quick tour of what this app is and how the pieces fit together"
      />

      {/* One-liner */}
      <Card className="p-5 bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">TPM-RCA</span> is an
            offline-first, zero-infrastructure desktop app for Total Productive
            Maintenance and Root-Cause Analysis. It runs entirely on your machine
            with a local database, and optionally syncs to a server or a peer on
            the same network — so a plant can operate with no IT dependency.
          </p>
        </div>
      </Card>

      {/* Architecture layers */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-900 mb-4">How it's built</h3>
        <div className="space-y-3">
          {LAYERS.map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-slate-100 p-4"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 grid place-items-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Runtime flow */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-900 mb-1">How it runs at runtime</h3>
        <p className="text-sm text-slate-500 mb-4">
          A tap in the UI becomes a Rust command that reads or writes SQLite, then
          returns a result — all offline. Sync is an explicit, opt-in action.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium">You tap a button</span>
          <span className="text-slate-400">→</span>
          <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium">React calls a command</span>
          <span className="text-slate-400">→</span>
          <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium">Rust validates & writes SQLite</span>
          <span className="text-slate-400">→</span>
          <span className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-medium">UI updates instantly</span>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Optional: when you press <span className="font-mono">Push</span> /{" "}
          <span className="font-mono">Pull</span> on the Sync page, SQLite is reconciled with
          PostgreSQL or a peer database on the LAN.
        </p>
      </Card>

      {/* Shop-floor capture */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-lg text-slate-900">Shop-floor capture</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Built to remove every tap on the floor. Whatever the device supports, you
          can log downtime hands-free:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CAPTURE.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="rounded-xl border border-slate-100 p-3">
              <Icon className="w-5 h-5 text-indigo-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recommended workflow */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-900 mb-4">Suggested workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STEPS.map(({ icon: Icon, title, detail }, i) => (
            <div key={title} className="flex gap-3 rounded-xl border border-slate-100 p-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-semibold shrink-0">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-400" /> {title}
                </p>
                <p className="text-sm text-slate-500 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Running it as a developer */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-900 mb-4">Running it yourself</h3>
        <p className="text-sm text-slate-500 mb-3">
          This is a standard Tauri + React project. Common commands from the project
          root:
        </p>
        <div className="space-y-2 font-mono text-sm">
          <div className="flex items-center gap-3 rounded-lg bg-slate-900 text-slate-100 px-3 py-2">
            <span className="text-emerald-400">$</span>
            <span>npm run tauri dev</span>
            <span className="ml-auto text-xs text-slate-400">launch the desktop app in dev</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900 text-slate-100 px-3 py-2">
            <span className="text-emerald-400">$</span>
            <span>npm run tauri build</span>
            <span className="ml-auto text-xs text-slate-400">produce a native installer</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900 text-slate-100 px-3 py-2">
            <span className="text-emerald-400">$</span>
            <span>npm run test</span>
            <span className="ml-auto text-xs text-slate-400">run the frontend unit tests</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900 text-slate-100 px-3 py-2">
            <span className="text-emerald-400">$</span>
            <span>npm run typecheck</span>
            <span className="ml-auto text-xs text-slate-400">type-check the frontend</span>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => window.open("ROADMAP.md", "_blank")}
        >
          View the product roadmap
        </Button>
      </div>
    </div>
  );
}

export default AboutPage;
