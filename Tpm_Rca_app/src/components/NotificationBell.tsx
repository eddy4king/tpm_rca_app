import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Modal, Button, LoadingState } from "./ui";

interface Notification {
  id: string;
  user_id: string | null;
  channel: string;
  ntype: string;
  title: string;
  body: string | null;
  ref_id: string | null;
  read: number;
  created_at: string | null;
}

interface Prefs {
  user_id: string;
  in_app: number;
  email: number;
  sms: number;
  push: number;
  pm_due: number;
  threshold_breach: number;
  wo_overdue: number;
}

const typeColor: Record<string, string> = {
  pm_due: "bg-amber-100 text-amber-700",
  wo_overdue: "bg-rose-100 text-rose-700",
  threshold_breach: "bg-orange-100 text-orange-700",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        invoke<Notification[]>("get_notifications"),
        invoke<number>("get_unread_count"),
      ]);
      setItems(list);
      setUnread(count);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try { await invoke("generate_alerts"); } catch { /* ignore */ }
      refresh();
    })();
  }, [user, refresh]);

  async function toggle() {
    setOpen((o) => !o);
    if (!open) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function readOne(id: string) {
    try {
      await invoke("mark_notification_read", { id });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)));
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  }

  async function readAll() {
    try {
      await invoke("mark_all_read");
      setItems((prev) => prev.map((n) => ({ ...n, read: 1 })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  async function runAlerts() {
    try {
      await invoke("generate_alerts");
      await refresh();
    } catch { /* ignore */ }
  }

  async function openPrefs() {
    if (!user) return;
    try {
      const p = await invoke<Prefs>("get_notification_prefs", { userId: user.id });
      setPrefs(p);
      setPrefsOpen(true);
    } catch { /* ignore */ }
  }

  async function savePrefs() {
    if (!prefs) return;
    try {
      await invoke("update_notification_prefs", {
        payload: {
          userId: prefs.user_id,
          inApp: prefs.in_app ? 1 : 0,
          email: prefs.email ? 1 : 0,
          sms: prefs.sms ? 1 : 0,
          push: prefs.push ? 1 : 0,
          pmDue: prefs.pm_due ? 1 : 0,
          thresholdBreach: prefs.threshold_breach ? 1 : 0,
          woOverdue: prefs.wo_overdue ? 1 : 0,
        },
      });
      setPrefsOpen(false);
    } catch { /* ignore */ }
  }

  function togglePref(key: keyof Prefs) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: prefs[key] ? 0 : 1 });
  }

  if (!user) return null;

  return (
    <>
      <div className="relative">
        <button
          onClick={toggle}
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold text-white bg-rose-500 rounded-full">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Alerts</span>
              <div className="flex items-center gap-1">
                <button onClick={runAlerts} className="text-xs text-blue-600 hover:underline" title="Check for due/overdue items">Scan</button>
                <button onClick={readAll} className="p-1 text-slate-400 hover:text-slate-700" title="Mark all read"><CheckCheck className="w-4 h-4" /></button>
                <button onClick={openPrefs} className="p-1 text-slate-400 hover:text-slate-700" title="Preferences"><Settings2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-6"><LoadingState label="Loading…" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No notifications.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.read && readOne(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 flex gap-3 items-start hover:bg-slate-50 ${n.read ? "opacity-60" : ""}`}
                  >
                    <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${typeColor[n.ntype] || "bg-slate-100 text-slate-600"}`}>
                      {n.ntype.replace("_", " ")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                      {n.body && <span className="block text-xs text-slate-500 truncate">{n.body}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {prefsOpen && prefs && (
        <Modal title="Notification Preferences" onClose={() => setPrefsOpen(false)} maxWidth="max-w-sm">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Channels</p>
            {([
              ["in_app", "In-app"],
              ["email", "Email"],
              ["sms", "SMS"],
              ["push", "Push"],
            ] as [keyof Prefs, string][]).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                <input type="checkbox" checked={!!prefs[k]} onChange={() => togglePref(k)} />
              </label>
            ))}
            <p className="text-sm font-semibold text-slate-700 pt-2">Alert types</p>
            {([
              ["pm_due", "PM overdue"],
              ["wo_overdue", "Work order overdue"],
              ["threshold_breach", "Condition threshold breach"],
            ] as [keyof Prefs, string][]).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                <input type="checkbox" checked={!!prefs[k]} onChange={() => togglePref(k)} />
              </label>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setPrefsOpen(false)}>Cancel</Button>
              <Button onClick={savePrefs}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
