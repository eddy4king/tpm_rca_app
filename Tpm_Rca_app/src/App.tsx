import { useState, useEffect } from "react";
import projectImage from "../project-image.png";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useRole } from "./context/RoleContext";
import EquipmentPage from "./pages/EquipmentPage";
import DowntimePage from "./pages/DowntimePage";
import RcaPage from "./pages/RcaPage";
import CAPAPage from "./pages/CAPAPage";
import DashboardPage from "./pages/DashboardPage";
import PMSchedulePage from "./pages/PMSchedulePage";
import HierarchyPage from "./pages/HierarchyPage";
import TasksPage from "./pages/TasksPage";
import TimelinePage from "./pages/TimelinePage";
import AuditPage from "./pages/AuditPage";
import SyncPage from "./pages/SyncPage";

import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";

type Page = "equipment" | "downtime" | "rca" | "capa" | "dashboard" | "pm" | "hierarchy" | "tasks" | "timeline" | "audit" | "sync" | "users";

function AppInner() {
  const { user, isAdmin, isLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [activePage, setActivePage] = useState<Page>("dashboard");

  useEffect(() => {
    const savedPage = localStorage.getItem("activePage") as Page | null;
    if (savedPage) setActivePage(savedPage);
  }, []);

  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  if (isLoading || roleLoading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-8">
      <img
        src={projectImage}
        alt="TPM-RCA Pro"
        className="w-48 h-48 object-contain rounded-3xl shadow-2xl"
      />
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  if (!user) return <LoginPage />;

  // Base navigation items for all users
  const baseNav = [
    { key: "dashboard", label: "Dashboard" },
    { key: "equipment", label: "Equipment" },
    { key: "hierarchy", label: "Hierarchy" },
    { key: "downtime", label: "Downtime" },
    { key: "rca", label: "RCA" },
    { key: "capa", label: "CAPA" },
    { key: "pm", label: "PM Scheduler" },
    { key: "tasks", label: "Tasks" },
    { key: "timeline", label: "Timeline" },
    { key: "audit", label: "Audit" },
    { key: "sync", label: "Sync" },
  ] as const;

  // Filter by role permissions if available; permission strings correspond to nav keys.
  const permittedNav = role && role.permissions.length
    ? baseNav.filter(item => role.permissions.includes("*") || role.permissions.includes(item.key))
    : baseNav;

  // Admins keep the Users page regardless of permissions.
  const navItems = isAdmin ? [...permittedNav, { key: "users", label: "Users" }] : permittedNav;

  return (
    <div className="h-screen flex bg-slate-50 text-slate-800">
      <Sidebar
        navItems={navItems as { key: string; label: string }[]}
        activePage={activePage}
        onNavigate={(p) => setActivePage(p as Page)}
      />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activePage === "dashboard" && <DashboardPage onNavigate={(p) => setActivePage(p as Page)} />}
        {activePage === "equipment" && <EquipmentPage />}
        {activePage === "downtime" && <DowntimePage />}
        {activePage === "rca" && <RcaPage />}
        {activePage === "capa" && <CAPAPage />}
        {activePage === "pm" && <PMSchedulePage />}
        {activePage === "hierarchy" && <HierarchyPage />}
        {activePage === "tasks" && <TasksPage />}
        {activePage === "timeline" && <TimelinePage />}
        {activePage === "audit" && <AuditPage />}
        {activePage === "sync" && <SyncPage />}

        {activePage === "users" && <UsersPage />}
      </main>
    </div>
  );
}

import { RoleProvider } from "./context/RoleContext";

function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <AppInner />
      </RoleProvider>
    </AuthProvider>
  );
}

export default App;