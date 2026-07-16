import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  RefreshCw, Database, CloudUpload, CloudDownload,
  CheckCircle2, XCircle, Clock3, AlertTriangle, Settings,
  HardDrive, Save, RotateCcw,
} from "lucide-react";
import {
  PageHeader, Card, Input, Button, StatCard, LoadingState, ConfirmDialog,
} from "../components/ui";

interface SyncConfig {
  id: string;
  postgres_url: string | null;
  auto_sync: number;
  sync_interval_minutes: number;
  last_synced_at: string | null;
  created_at: string | null;
}

interface SyncLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  payload: string;
  synced: number;
  error: string | null;
  created_at: string | null;
}

interface BackupInfo {
  name: string;
  path: string;
  size_bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SyncPage() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [postgresUrl, setPostgresUrl] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(30);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [cfg, syncLogs] = await Promise.all([
        invoke<SyncConfig>("get_sync_config_cmd"),
        invoke<SyncLog[]>("get_sync_logs"),
      ]);
      setConfig(cfg);
      setLogs(syncLogs);
      setPostgresUrl(cfg.postgres_url || "");
      setAutoSync(cfg.auto_sync === 1);
      setSyncInterval(cfg.sync_interval_minutes || 30);
      loadBackups();
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function loadBackups() {
    try {
      setBackups(await invoke<BackupInfo[]>("list_backups"));
    } catch {
      /* backups directory may not exist yet – ignore */
    }
  }

  async function handleBackup() {
    try {
      setBackingUp(true);
      const path = await invoke<string>("backup_database");
      showMessage(`Backup created: ${path}`, "success");
      loadBackups();
    } catch (err) {
      showMessage(String(err), "error");
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      const result = await invoke<string>("restore_database", { path: restoreTarget.path });
      showMessage(result, "success");
      setRestoreTarget(null);
      loadData();
    } catch (err) {
      showMessage(String(err), "error");
    } finally {
      setRestoring(false);
    }
  }

  async function handleSaveConfig() {
    try {
      const updated = await invoke<SyncConfig>("update_sync_config", {
        payload: {
          postgresUrl: postgresUrl || null,
          autoSync: autoSync ? 1 : 0,
          syncIntervalMinutes: syncInterval,
        },
      });
      setConfig(updated);
      showMessage("Configuration saved successfully.", "success");
    } catch (err) {
      showMessage(String(err), "error");
    }
  }

  async function handleTestConnection() {
    if (!postgresUrl) { showMessage("Enter a PostgreSQL URL first.", "error"); return; }
    try {
      setTesting(true);
      const result = await invoke<string>("test_postgres_connection", { postgresUrl });
      setTestResult({ success: true, message: result });
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function handlePush() {
    try {
      setSyncing(true);
      const result = await invoke<string>("push_to_postgres");
      showMessage(result, "success");
      loadData();
    } catch (err) {
      showMessage(String(err), "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePull() {
    try {
      setSyncing(true);
      const result = await invoke<string>("pull_from_postgres");
      showMessage(result, "success");
      loadData();
    } catch (err) {
      showMessage(String(err), "error");
    } finally {
      setSyncing(false);
    }
  }

  function showMessage(text: string, type: "success" | "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }

  const unsynced = logs.filter(l => l.synced === 0).length;
  const failed = logs.filter(l => l.error !== null).length;
  const synced = logs.filter(l => l.synced === 1).length;

  if (loading) return <LoadingState label="Loading Sync Settings..." />;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* HEADER */}
        <PageHeader
          title="Sync Engine"
          subtitle="Two-way sync between SQLite and PostgreSQL"
          actions={
            <div className="flex gap-3">
              <Button onClick={handlePull} disabled={syncing || !config?.postgres_url}>
                <CloudDownload className="w-4 h-4" />
                {syncing ? "Syncing..." : "Pull from PostgreSQL"}
              </Button>
              <Button onClick={handlePush} disabled={syncing || !config?.postgres_url}>
                <CloudUpload className="w-4 h-4" />
                {syncing ? "Syncing..." : "Push to PostgreSQL"}
              </Button>
            </div>
          }
        />

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Changes" value={<span className="text-slate-700">{logs.length}</span>} />
          <StatCard label="Pending Sync" value={<span className="text-amber-700">{unsynced}</span>} />
          <StatCard label="Synced" value={<span className="text-emerald-700">{synced}</span>} />
          <StatCard label="Failed" value={<span className="text-red-700">{failed}</span>} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CONFIG PANEL */}
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold text-lg">Connection Settings</h3>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                config?.postgres_url
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-red-100 text-red-700 border-red-200"
              }`}>
                <span className={`w-2 h-2 rounded-full ${config?.postgres_url ? "bg-emerald-500" : "bg-red-500"}`} />
                {config?.postgres_url ? "Configured" : "Not Configured"}
              </span>
            </div>

            <div className="space-y-4">
               <div>
                 <label className="text-sm font-medium text-slate-600 block mb-1.5">PostgreSQL URL</label>
                 <Input
                   type="password"
                   placeholder="postgresql://user:password@host:5432/dbname"
                   value={postgresUrl}
                   onChange={e => setPostgresUrl(e.target.value)}
                   className="font-mono"
                 />
                 <p className="text-xs text-slate-400 mt-1">Supports local PostgreSQL and cloud providers (Supabase, Railway, Neon)</p>
               </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-700">Auto Sync</p>
                  <p className="text-xs text-slate-400">Automatically sync on a schedule</p>
                </div>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-12 h-6 rounded-full transition-colors ${autoSync ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${autoSync ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              {autoSync && (
                 <div>
                   <label className="text-sm font-medium text-slate-600 block mb-1.5">Sync Interval (minutes)</label>
                   <Input
                     type="number"
                     min={5}
                     max={1440}
                     value={syncInterval}
                     onChange={e => setSyncInterval(parseInt(e.target.value))}
                   />
                 </div>
              )}

              {config?.last_synced_at && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
                  <Clock3 className="w-4 h-4" />
                  <span>Last synced: {new Date(config.last_synced_at).toLocaleString()}</span>
                </div>
              )}

              {testResult && (
                <div className={`flex items-center gap-2 text-sm rounded-xl p-3 ${testResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleTestConnection}
                  disabled={testing || !postgresUrl}
                >
                  <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
                  Test Connection
                </Button>
                <Button className="flex-1" onClick={handleSaveConfig}>
                  Save Config
                </Button>
              </div>
            </div>
          </Card>

          {/* SYNC LOG */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Sync Log</h3>
              <button onClick={loadData} className="text-slate-400 hover:text-slate-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No sync activity yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className={`p-3 rounded-xl border text-sm ${log.error ? "bg-red-50 border-red-100" : log.synced ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {log.error ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                          log.synced ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        <span className="font-medium capitalize">{log.table_name}</span>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                          log.operation === "INSERT" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                          log.operation === "UPDATE" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                          "bg-red-100 text-red-700 border border-red-200"
                        }`}>{log.operation}</span>
                      </div>
                      <span className="text-xs text-slate-400">{log.created_at?.slice(0, 16)}</span>
                    </div>
                    {log.error && <p className="text-xs text-red-600 mt-1">{log.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* BACKUP & RESTORE */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-lg">Backup &amp; Restore</h3>
            </div>
            <Button onClick={handleBackup} loading={backingUp}>
              <Save className="w-4 h-4" /> Create Backup
            </Button>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Backups are full, portable copies of the local database saved to the
            <span className="font-mono"> backups </span> folder next to your database file.
            Restoring replaces all current data (your login and sync settings are preserved).
          </p>

          {backups.length === 0 ? (
            <div className="text-center py-10">
              <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No backups yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {backups.map(b => (
                <div key={b.path} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-700 truncate">{b.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(b.size_bytes)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRestoreTarget(b)}
                    disabled={restoring}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* HOW IT WORKS */}
        <Card>
          <h3 className="font-bold mb-4">How Sync Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-2">1. Local First</p>
              <p>All data is written to SQLite first. The app works fully offline without any internet connection.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-2">2. Snapshot Push</p>
              <p>Push uploads the full current state of every table to PostgreSQL using idempotent upserts, plus any queued change-log entries.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-2">3. Two-Way Sync</p>
              <p>Pull fetches remote records back into SQLite. Conflicts resolve by last-write-wins using each record's updated_at.</p>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore Database"
        confirmLabel={restoring ? "Restoring…" : "Restore"}
        message={
          <>
            This will <strong>replace all current data</strong> with the contents of{" "}
            <span className="font-mono">{restoreTarget?.name}</span>. This cannot be undone.
            Consider creating a backup first. Continue?
          </>
        }
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      {/* MESSAGE TOAST */}
      {message && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-lg text-white text-sm font-medium flex items-center gap-2 z-50 ${message.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
    </div>
  );
}

export default SyncPage;
