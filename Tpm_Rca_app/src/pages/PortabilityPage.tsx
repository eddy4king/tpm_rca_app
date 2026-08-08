import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Share2, Database, ShieldCheck, Download, CloudUpload, Wifi,
  HardDrive, FileDown, CheckCircle2,
} from "lucide-react";
import {
  PageHeader, Card, Button, Banner, StatCard, LoadingState,
} from "../components/ui";

interface SyncConfig {
  id: string;
  postgres_url: string | null;
  auto_sync: number;
  sync_interval_minutes: number;
  last_synced_at: string | null;
}

interface EgressDestination {
  name: string;
  icon: typeof Share2;
  method: string;
  what: string;
  where: string;
  reversible: string;
}

/** Masks a connection string so secrets never appear on screen. */
function maskUrl(url: string | null): string {
  if (!url) return "not configured";
  try {
    const u = new URL(url);
    const host = u.host || url;
    return `${u.protocol}//${u.username ? "***:***@" : ""}${host}`;
  } catch {
    return url.replace(/:[^:@/]*@/, ":***@");
  }
}

const DATA_CATEGORIES = [
  "Equipment / asset register",
  "Hierarchy & plant structure",
  "Downtime events",
  "RCA investigations & CAPA",
  "PM schedule & work orders",
  "Knowledge notes & photos",
  "Financials (cost / asset value)",
  "Inventory & parts",
  "Timesheets & labor",
  "Users, roles & audit log",
  "Sync & peer logs",
];

function PortabilityPage() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await invoke<SyncConfig>("get_sync_config_cmd");
        if (active) setConfig(cfg);
      } catch {
        /* portability report is informational; continue without sync config */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const destinations = useMemo<EgressDestination[]>(() => {
    const pg = maskUrl(config?.postgres_url ?? null);
    return [
      {
        name: "Local device",
        icon: HardDrive,
        method: "SQLite (offline-first)",
        what: "Entire database — all categories above.",
        where: "Stored on this device only. Nothing leaves unless you choose to.",
        reversible: "N/A — source of truth.",
      },
      {
        name: "Local backup",
        icon: FileDown,
        method: "Export .db / CSV",
        what: "Full snapshot or per-table exports.",
        where: "A file you choose on this device or external drive.",
        reversible: "Yes — re-import to restore.",
      },
      {
        name: "Peer (LAN) sync",
        icon: Wifi,
        method: "VACUUM INTO + SQLite merge",
        what: "Changed records (no server required).",
        where: `Another device on your local network at the peer's address.`,
        reversible: "Yes — merge is idempotent.",
      },
      {
        name: "Postgres sync",
        icon: CloudUpload,
        method: config?.auto_sync ? `Auto every ${config.sync_interval_minutes}m` : "Manual push",
        what: "Changed records to a self-hosted server.",
        where: pg,
        reversible: "Yes — your server, your data.",
      },
      {
        name: "Reports export",
        icon: Download,
        method: "PDF / CSV download",
        what: "Selected reports & work orders.",
        where: "A local file you choose.",
        reversible: "Yes.",
      },
    ];
  }, [config]);

  function buildReport() {
    return {
      generated_at: new Date().toISOString(),
      app: "TPM-RCA Pro",
      principle: "Your data is yours — offline-first, no cloud lock-in.",
      data_categories: DATA_CATEGORIES,
      egress_destinations: destinations.map((d) => ({
        name: d.name,
        method: d.method,
        what: d.what,
        where: d.where,
        reversible: d.reversible,
      })),
      self_host: {
        postgres: maskUrl(config?.postgres_url ?? null),
        auto_sync: Boolean(config?.auto_sync),
        sync_interval_minutes: config?.sync_interval_minutes ?? null,
        docker_compose: "docker-compose.yml (Postgres sync target included in repo)",
      },
    };
  }

  function handleDownload() {
    const report = buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tpm-rca-portability-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Data Portability Report" subtitle="What leaves this device, and where it goes" />
        <LoadingState label="Loading portability info…" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Data Portability Report"
        subtitle="Exactly what leaves this device and where it goes"
        actions={
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4" /> Download report
          </Button>
        }
      />

      <Banner tone="success">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          This app is offline-first. By default nothing leaves the device — every
          egress path below is opt-in and reversible.
        </span>
      </Banner>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Database className="w-5 h-5" />}
          tint="indigo"
          label="Data categories"
          value={String(DATA_CATEGORIES.length)}
        />
        <StatCard
          icon={<Share2 className="w-5 h-5" />}
          tint="emerald"
          label="Egress paths"
          value={String(destinations.length)}
        />
        <StatCard
          icon={<CloudUpload className="w-5 h-5" />}
          tint="sky"
          label="Postgres sync"
          value={config?.postgres_url ? "configured" : "off"}
        />
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">What your data contains</h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DATA_CATEGORIES.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Where data can go</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 text-left font-medium">Destination</th>
                <th className="p-3 text-left font-medium">Method</th>
                <th className="p-3 text-left font-medium">What is sent</th>
                <th className="p-3 text-left font-medium">Where it goes</th>
                <th className="p-3 text-left font-medium">Reversible</th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d, i) => {
                const Icon = d.icon;
                return (
                  <tr
                    key={d.name}
                    className={`border-b border-slate-100 ${i % 2 ? "bg-slate-50" : ""}`}
                  >
                    <td className="p-3 font-medium text-slate-800">
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-indigo-500" /> {d.name}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{d.method}</td>
                    <td className="p-3 text-slate-600">{d.what}</td>
                    <td className="p-3 text-slate-600">
                      <span className="font-mono text-xs break-all">{d.where}</span>
                    </td>
                    <td className="p-3 text-slate-600">{d.reversible}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Self-hosting & lock-in</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          The Postgres sync target ships as a <code className="bg-slate-100 px-1 rounded">docker-compose.yml</code> in the
          repository — bring your own server, no per-seat subscription. Peer (LAN)
          sync needs no server at all. Your database is a standard SQLite file you
          can copy, back up, or move to any machine.
        </p>
        {config?.postgres_url && (
          <p className="text-xs text-slate-400 mt-3">
            Current sync target: <span className="font-mono">{maskUrl(config.postgres_url)}</span>
          </p>
        )}
      </Card>

      {downloaded && (
        <Banner tone="success">Portability report downloaded.</Banner>
      )}
    </div>
  );
}

export default PortabilityPage;
