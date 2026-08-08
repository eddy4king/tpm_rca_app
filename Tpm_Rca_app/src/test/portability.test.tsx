import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import PortabilityPage from "../pages/PortabilityPage";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

describe("PortabilityPage (data egress report)", () => {
  const createObjectURL = vi.fn((_b: Blob) => "blob:report");
  const revokeObjectURL = vi.fn();
  const clickSpy = vi.fn();

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "get_sync_config_cmd") {
        return {
          id: "1",
          postgres_url: "postgres://admin:secret@db.example.com:5432/tpm",
          auto_sync: 1,
          sync_interval_minutes: 30,
          last_synced_at: null,
        };
      }
      return null;
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    // jsdom doesn't implement anchor.click navigation side effects.
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: clickSpy,
    });
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    clickSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists every egress destination and the configured sync target", async () => {
    render(<PortabilityPage />);
    expect(await screen.findByText(/where data can go/i)).toBeInTheDocument();
    expect(screen.getByText(/Local device/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Peer \(LAN\) sync/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Postgres sync/i).length).toBeGreaterThan(0);
    // Secret credentials are masked, not rendered.
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/db\.example\.com:5432/i).length).toBeGreaterThan(0);
  });

  it("downloads a JSON portability report on click", async () => {
    render(<PortabilityPage />);
    const button = await screen.findByRole("button", { name: /download report/i });
    fireEvent.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });
});
