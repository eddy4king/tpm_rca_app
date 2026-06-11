import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  RefreshCw, Database, CloudUpload, CloudDownload,
  CheckCircle2, XCircle, Clock3, AlertTriangle, Settings,
} from "lucide-react";

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
      setLoading(false);
    } catch (err) {
      setLoading(false);
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

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading Sync Settings...</div>;

  return (
    <div className="flex flex-col bg-slate-100 text-slate-800" style={{ height: "calc(100vh - 80px)" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold">Sync Engine</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Two-way sync between SQLite and PostgreSQL</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePull}
              disabled={syncing || !config?.postgres_url}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium text-sm"
            >
              <CloudDownload className="w-4 h-4" />
              {syncing ? "Syncing..." : "Pull from PostgreSQL"}
            </button>
            <button
              onClick={handlePush}
              disabled={syncing || !config?.postgres_url}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium text-sm"
            >
              <CloudUpload className="w-4 h-4" />
              {syncing ? "Syncing..." : "Push to PostgreSQL"}
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500">Total Changes</p>
            <h2 className="text-3xl font-bold mt-1">{logs.length}</h2>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs text-amber-600">Pending Sync</p>
            <h2 className="text-3xl font-bold mt-1 text-amber-700">{unsynced}</h2>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs text-emerald-600">Synced</p>
            <h2 className="text-3xl font-bold mt-1 text-emerald-700">{synced}</h2>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-xs text-red-600">Failed</p>
            <h2 className="text-3xl font-bold mt-1 text-red-700">{failed}</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CONFIG PANEL */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-lg">Connection Settings</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">PostgreSQL URL</label>
                <input
                  type="password"
                  placeholder="postgresql://user:password@host:5432/dbname"
                  value={postgresUrl}
                  onChange={e => setPostgresUrl(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono"
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
                  <label className="text-sm font-medium text-slate-600 block mb-1">Sync Interval (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={syncInterval}
                    onChange={e => setSyncInterval(parseInt(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
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
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !postgresUrl}
                  className="flex-1 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
                  Test Connection
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium"
                >
                  Save Config
                </button>
              </div>
            </div>
          </div>

          {/* SYNC LOG */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          log.operation === "INSERT" ? "bg-blue-100 text-blue-700" :
                          log.operation === "UPDATE" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>{log.operation}</span>
                      </div>
                      <span className="text-xs text-slate-400">{log.created_at?.slice(0, 16)}</span>
                    </div>
                    {log.error && <p className="text-xs text-red-600 mt-1">{log.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-6">
          <h3 className="font-bold mb-4">How Sync Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-2">1. Local First</p>
              <p>All data is written to SQLite first. The app works fully offline without any internet connection.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-2">2. Change Tracking</p>
              <p>Every insert, update, and delete is logged in the sync_log table with the full record payload.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-2">3. Two-Way Sync</p>
              <p>Push sends local changes to PostgreSQL. Pull fetches remote changes back. Conflicts resolve by last-write-wins.</p>
            </div>
          </div>
        </div>
      </div>

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