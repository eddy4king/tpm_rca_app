import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  answerQuestion,
  tipsForPage,
  pageLabel,
  SUGGESTED_QUESTIONS,
  askRuca,
  getLlmConfig,
} from "./assistant";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

describe("assistant brain", () => {
  it("returns contextual tips for a known page", () => {
    const tips = tipsForPage("downtime");
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0].title).toBeTruthy();
  });

  it("returns no tips for an unknown page", () => {
    expect(tipsForPage("does-not-exist")).toEqual([]);
  });

  it("labels the current page", () => {
    expect(pageLabel("sync")).toBe("Sync");
    expect(pageLabel(undefined)).toBe("the app");
  });

  it("answers offline / architecture questions", () => {
    const a = answerQuestion("How does this app run?", "about");
    expect(a.toLowerCase()).toContain("tauri");
    const b = answerQuestion("does it work offline?", "dashboard");
    expect(b.toLowerCase()).toContain("offline");
  });

  it("answers sync / backup questions regardless of page", () => {
    const a = answerQuestion("How do I back up the database?", "equipment");
    expect(a.toLowerCase()).toContain("backup");
    const b = answerQuestion("set up postgres sync", "downtime");
    expect(b.toLowerCase()).toContain("postgres");
  });

  it("falls back to a helpful message for unrecognised questions", () => {
    const a = answerQuestion("tell me a joke");
    expect(a.length).toBeGreaterThan(0);
    expect(SUGGESTED_QUESTIONS.length).toBeGreaterThan(0);
  });
});

describe("askRuca (LLM with offline fallback)", () => {
  beforeEach(() => invokeMock.mockReset());
  afterEach(() => invokeMock.mockReset());

  it("returns the LLM answer when enabled and reachable", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_llm_config") return Promise.resolve({ enabled: true, provider: "ollama", baseUrl: "http://localhost:11434", model: "llama3.2", apiKey: "" });
      if (cmd === "ask_llm") return Promise.resolve("Check the PM schedule for pump 1.");
      return Promise.reject(new Error("unexpected " + cmd));
    });
    const a = await askRuca("When is pump 1 due?", "pm");
    expect(a).toBe("Check the PM schedule for pump 1.");
  });

  it("falls back to the offline KB when the model is disabled", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_llm_config") return Promise.resolve({ enabled: false, provider: "ollama", baseUrl: "http://localhost:11434", model: "llama3.2", apiKey: "" });
      return Promise.reject(new Error("unexpected " + cmd));
    });
    const a = await askRuca("How do I back up the database?", "downtime");
    expect(a.toLowerCase()).toContain("backup");
  });

  it("falls back to the offline KB when the LLM call fails", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_llm_config") return Promise.resolve({ enabled: true, provider: "ollama", baseUrl: "http://localhost:11434", model: "llama3.2", apiKey: "" });
      return Promise.reject(new Error("Could not reach Ollama"));
    });
    const a = await askRuca("set up postgres sync", "sync");
    expect(a.toLowerCase()).toContain("postgres");
  });

  it("passes history and page context through to the ask_llm command", async () => {
    let seen: unknown;
    invokeMock.mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_llm_config") return Promise.resolve({ enabled: true, provider: "ollama", baseUrl: "http://localhost:11434", model: "llama3.2", apiKey: "" });
      if (cmd === "ask_llm") { seen = args; return Promise.resolve("ok"); }
      return Promise.reject(new Error("unexpected " + cmd));
    });
    await askRuca("What is MTTR?", "dashboard", [{ role: "user", content: "hi" }]);
    expect(seen).toBeTruthy();
    const args = seen as { message: string; page: string | null; history: unknown[] };
    expect(args.message).toBe("What is MTTR?");
    expect(args.page).toBe("dashboard");
    expect(args.history).toHaveLength(1);
  });

  it("returns the default config shape when the backend is missing", async () => {
    invokeMock.mockRejectedValue(new Error("not in window.__TAURI__"));
    const cfg = await getLlmConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.provider).toBe("ollama");
    expect(cfg.model).toBeTruthy();
  });
});
