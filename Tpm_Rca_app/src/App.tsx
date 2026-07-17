import { useState, useEffect } from "react";
import projectImage from "../project-image.jpeg";
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
import FmeaPage from "./pages/FmeaPage";
import CbmPage from "./pages/CbmPage";
import KnowledgePage from "./pages/KnowledgePage";
import FinancialsPage from "./pages/FinancialsPage";
import InventoryPage from "./pages/InventoryPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import TimesheetsPage from "./pages/TimesheetsPage";
import SchedulePage from "./pages/SchedulePage";
import ReportsPage from "./pages/ReportsPage";

import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import { TourProvider } from "./context/TourContext";

type Page = "equipment" | "downtime" | "rca" | "capa" | "dashboard" | "pm" | "hierarchy" | "tasks" | "timeline" | "audit" | "sync" | "fmea" | "cbm" | "knowledge" | "financials" | "inventory" | "workorders" | "timesheets" | "schedule" | "reports" | "users";

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center gap-8">
      <img
        src={projectImage}
        alt="TPM-RCA Pro"
        className="w-56 h-80 object-contain rounded-3xl shadow-2xl"
      />
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl font-bold text-white leading-tight">TPM-RCA Pro</h1>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
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
    { key: "fmea", label: "FMEA" },
    { key: "cbm", label: "CBM" },
    { key: "knowledge", label: "Knowledge" },
    { key: "financials", label: "Financials" },
    { key: "inventory", label: "Inventory" },
    { key: "workorders", label: "Work Orders" },
    { key: "timesheets", label: "Timesheets" },
    { key: "schedule", label: "Schedule" },
    { key: "reports", label: "Reports" },
    { key: "sync", label: "Sync" },
  ] as const;

  // Filter by role permissions if available; permission strings correspond to nav keys.
  const permittedNav = role && role.permissions.length
    ? baseNav.filter(item => role.permissions.includes("*") || role.permissions.includes(item.key))
    : baseNav;

  // Admins keep the Users page regardless of permissions.
  const navItems = isAdmin ? [...permittedNav, { key: "users", label: "Users" }] : permittedNav;

  return (
    <TourProvider navigate={(p) => setActivePage(p as Page)}>
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
          {activePage === "fmea" && <FmeaPage />}
          {activePage === "cbm" && <CbmPage />}
          {activePage === "knowledge" && <KnowledgePage />}
          {activePage === "financials" && <FinancialsPage />}
          {activePage === "inventory" && <InventoryPage />}
          {activePage === "workorders" && <WorkOrdersPage />}
          {activePage === "timesheets" && <TimesheetsPage />}
          {activePage === "schedule" && <SchedulePage onNavigate={(p) => setActivePage(p as Page)} />}
          {activePage === "reports" && <ReportsPage />}

          {activePage === "users" && <UsersPage />}
        </main>
      </div>
    </TourProvider>
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