import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import App from "../App";
import { LanguageProvider } from "../context/LanguageContext";
import { ToastProvider } from "../context/ToastContext";
import { ThemeProvider } from "../context/ThemeContext";

function renderApp() {
  return render(
    <LanguageProvider>
      <ToastProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}

// --- Tauri backend mock -----------------------------------------------------
const USER = {
  id: "u1",
  username: "admin",
  email: "admin@local",
  role: "Admin",
  is_active: 1,
  created_at: null,
  last_login_at: null,
};

const EQ = [
  {
    id: "eq1",
    tag_number: "PMP-01",
    name: "Pump 1",
    status: "ok",
    criticality: "low",
    equipment_type: "pump",
    location: "A",
    area_id: null,
    parent_id: null,
    created_at: null,
    updated_at: null,
    cost_per_hour: 10,
    asset_value: 1000,
    description: "",
  },
];

function resolve(cmd: string): unknown {
  switch (cmd) {
    case "clear_all_sessions":
    case "logout_user":
      return null;
    case "has_users":
      return true;
    case "get_sso_config":
      return { enabled: false, label: "Single Sign-On", issuer: "" };
    case "get_ldap_config":
      return { enabled: false, label: "LDAP" };
    case "login_user":
    case "validate_session":
    case "await_sso_login":
      return [USER, "token-123"];
    case "get_role_permissions":
      return [{ name: "Admin", description: "Admin", permissions: ["*"] }];
    case "get_notifications":
      return [];
    case "get_unread_count":
      return 0;
    case "get_notification_prefs":
      return { userId: "u1", email: false, push: false, sms: false };
    case "get_all_equipment":
      return EQ;
    case "get_all_areas":
    case "get_all_plants":
    case "get_all_downtime":
    case "get_all_capas":
    case "get_all_pm_schedules":
    case "get_investigations":
    case "get_investigation_capas":
    case "get_investigation_nodes":
    case "get_audit_logs":
    case "get_fmea":
    case "cbm_triggers":
    case "get_cbm_rules":
    case "search_knowledge_notes":
    case "get_items":
    case "get_low_stock_items":
    case "get_item_transactions":
    case "get_wos":
    case "get_wo_labor":
    case "get_wo_parts":
    case "get_maintenance_timeline":
    case "get_report_schedules":
    case "get_oee_leaderboard":
    case "list_kaizen":
    case "list_production_logs":
    case "get_all_users":
    case "get_sync_logs":
    case "list_backups":
    case "get_timesheet_entries":
      return [];
    case "get_oee_metrics":
    case "get_equipment_oee":
      return { availability: 1, performance: 1, quality: 1, oee: 1, planned_minutes: 0, run_minutes: 0, total_minutes: 0, good_units: 0, total_units: 0 };
    case "rca_coach_report":
      return { categories: [], recurring: [], actions: [], stats: { totalDowntime: 0, rcaCount: 0 } };
    case "reliability_report":
      return { pareto: [], mtbf: [], mttr: [], weibull: null, rul: null };
    case "get_sync_config_cmd":
      return { id: "1", postgres_url: null, auto_sync: 0, sync_interval_minutes: 30, last_synced_at: null };
    default:
      return [];
  }
}

const invokeMock = vi.fn((cmd: string) => Promise.resolve(resolve(cmd)));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, _args?: unknown) => invokeMock(cmd),
}));

// jsdom lacks ResizeObserver (used by recharts / charts).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;

// --- Test ------------------------------------------------------------------
describe("GUI click-through (headless)", () => {
  beforeEach(() => {
    invokeMock.mockClear();
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it("logs in and walks every navigation item without crashing", async () => {
    renderApp();

    // Land on the login screen, authenticate as admin.
    const userField = await screen.findByPlaceholderText(/username/i);
    fireEvent.change(userField, { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "admin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Shell renders with the sidebar navigation.
    const nav = await screen.findByRole("navigation");
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(10);

    // Click through every nav item; the main panel must render each page.
    for (const btn of buttons) {
      fireEvent.click(btn);
      const main = document.querySelector("main");
      expect(main).not.toBeNull();
      expect(main!.childElementCount).toBeGreaterThan(0);
    }
  });

  it("reaches the new Portability report and shows egress data", async () => {
    renderApp();
    fireEvent.change(await screen.findByPlaceholderText(/username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const nav = await screen.findByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /portability/i }));

    expect(await screen.findByText(/where data can go/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Peer \(LAN\) sync/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Postgres sync/i).length).toBeGreaterThan(0);
  });
});
