import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import EquipmentPage from "./pages/EquipmentPage";
import DowntimePage from "./pages/DowntimePage";
import RcaPage from "./pages/RcaPage";
import CAPAPage from "./pages/CAPAPage";
import DashboardPage from "./pages/DashboardPage";
import PMSchedulePage from "./pages/PMSchedulePage";
import SyncPage from "./pages/SyncPage";
import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import { LogOut, User } from "lucide-react";

type Page = "equipment" | "downtime" | "rca" | "capa" | "dashboard" | "pm" | "sync" | "users";

function AppInner() {
  const { user, logout, isAdmin, isLoading } = useAuth();
  const [activePage, setActivePage] = useState<Page>("dashboard");

  useEffect(() => {
    const savedPage = localStorage.getItem("activePage") as Page | null;
    if (savedPage) setActivePage(savedPage);
  }, []);

  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  if (isLoading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      Loading...
    </div>
  );

  if (!user) return <LoginPage />;

  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "equipment", label: "Equipment" },
    { key: "downtime", label: "Downtime" },
    { key: "rca", label: "RCA" },
    { key: "capa", label: "CAPA" },
    { key: "pm", label: "PM Scheduler" },
    { key: "sync", label: "Sync" },
    ...(isAdmin ? [{ key: "users", label: "Users" }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-slate-800 text-white px-6 py-3 flex items-center gap-4 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-tight mr-2">TPM-RCA Pro</h1>
        <div className="flex gap-1 flex-1 flex-wrap">
          {navItems.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActivePage(key as Page)}
              className={`px-4 py-2 rounded-xl font-medium transition-all text-sm ${
                activePage === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "hover:bg-slate-700 text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-2 bg-slate-700 rounded-xl px-3 py-2">
            <User className="w-4 h-4 text-slate-300" />
            <span className="text-sm text-slate-200">{user.username}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              user.role === "Admin" ? "bg-red-500" :
              user.role === "Engineer" ? "bg-blue-500" :
              user.role === "Technician" ? "bg-amber-500" : "bg-slate-500"
            } text-white`}>{user.role}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-slate-700"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {activePage === "dashboard" && <DashboardPage />}
        {activePage === "equipment" && <EquipmentPage />}
        {activePage === "downtime" && <DowntimePage />}
        {activePage === "rca" && <RcaPage />}
        {activePage === "capa" && <CAPAPage />}
        {activePage === "pm" && <PMSchedulePage />}
        {activePage === "sync" && <SyncPage />}
        {activePage === "users" && <UsersPage />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;