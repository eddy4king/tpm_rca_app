import { describe, it, expect } from "vitest";
import { toCsv } from "./export";

interface Row {
  name: string;
  value: number | null;
  note: string;
}

describe("toCsv", () => {
  it("renders a header row and data rows", () => {
    const rows: Row[] = [
      { name: "Pump", value: 5, note: "ok" },
      { name: "Motor", value: null, note: "check" },
    ];
    const csv = toCsv(rows, [
      { key: "name", label: "Name" },
      { key: "value", label: "Value" },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Value");
    expect(lines[1]).toBe("Pump,5");
    expect(lines[2]).toBe("Motor,"); // null -> empty cell
  });

  it("escapes commas, quotes and newlines", () => {
    const rows: Row[] = [
      { name: 'A "quoted", value', value: 1, note: "line1\nline2" },
    ];
    const csv = toCsv(rows, [
      { key: "name", label: "Name" },
      { key: "note", label: "Note" },
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('"A ""quoted"", value"');
    expect(dataLine).toContain('"line1\nline2"');
  });

  it("applies a custom formatter", () => {
    const rows: Row[] = [{ name: "X", value: 90, note: "" }];
    const csv = toCsv(rows, [
      { key: "value", label: "Status", format: (v) => ((v as number) > 50 ? "High" : "Low") },
    ]);
    expect(csv.split("\r\n")[1]).toBe("High");
  });
});
