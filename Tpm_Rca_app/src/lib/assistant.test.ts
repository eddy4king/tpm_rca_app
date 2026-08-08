import { describe, it, expect } from "vitest";
import {
  answerQuestion,
  tipsForPage,
  pageLabel,
  SUGGESTED_QUESTIONS,
} from "./assistant";

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
