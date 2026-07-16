import { LucideIcon, LayoutDashboard, Cog, Network, Activity, Workflow, ClipboardCheck, CalendarClock, ListTodo, GitCommitVertical, History, Users, RefreshCw, Circle, LogOut, HelpCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, LANGUAGES, Lang } from "../context/LanguageContext";
import { useTour } from "../context/TourContext";
import ThemeToggle from "./ThemeToggle";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  equipment: Cog,
  hierarchy: Network,
  downtime: Activity,
  rca: Workflow,
  capa: ClipboardCheck,
  pm: CalendarClock,
  tasks: ListTodo,
  timeline: GitCommitVertical,
  audit: History,
  users: Users,
  sync: RefreshCw,
};

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-rose-500/20 text-rose-300",
  Engineer: "bg-sky-500/20 text-sky-300",
  Technician: "bg-amber-500/20 text-amber-300",
  Viewer: "bg-slate-500/20 text-slate-300",
};

interface NavItem { key: string; label: string; }

export default function Sidebar({
  navItems,
  activePage,
  onNavigate,
}: {
  navItems: NavItem[];
  activePage: string;
  onNavigate: (p: string) => void;
}) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { openHelp } = useTour();
  const initials = (user?.username || "TP").slice(0, 2).toUpperCase();

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 border-r border-black/20">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white font-bold shadow-lg shadow-indigo-500/30">
          T
        </div>
        <div className="leading-tight">
          <p className="text-white font-semibold">TPM-RCA</p>
          <p className="text-[11px] text-slate-400">{t("brand.subtitle")}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" data-tour="nav">
        {navItems.map(({ key, label }) => {
          const Icon = ICONS[key] || Circle;
          const active = activePage === key;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition group
                ${active
                  ? "bg-white/10 text-white shadow-inner"
                  : "hover:bg-white/5 text-slate-400 hover:text-slate-200"}`}
            >
              <Icon className={`w-5 h-5 transition ${active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              <span>{t(`nav.${key}`, label)}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
          );
        })}
      </nav>

      {/* User + actions */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-slate-700 grid place-items-center text-white text-sm font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{user?.username}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${ROLE_BADGE[user?.role || ""] || "bg-slate-500/20 text-slate-300"}`}>
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={openHelp}
          data-tour="help"
          className="w-full flex items-center justify-center gap-1.5 text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-xl text-sm font-medium transition"
        >
          <HelpCircle className="w-4 h-4" /> Help & Tour
        </button>
        <div className="flex gap-2 mt-2" data-tour="actions">
          <ThemeToggle className="flex-1 justify-center bg-white/5 hover:bg-white/10" />
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 px-3 py-2 rounded-xl text-sm font-medium transition"
          >
            <LogOut className="w-4 h-4" /> {t("action.logout")}
          </button>
        </div>
        <select
          aria-label={t("common.language")}
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="mt-2 w-full bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl px-3 py-2 border border-white/10 focus:outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="text-slate-800">
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
