import { describe, it, expect } from "vitest";
import { equipmentQrValue, parseEquipmentQr } from "./QrCode";

describe("equipment QR helpers", () => {
  it("builds a payload with an encoded tag", () => {
    expect(equipmentQrValue("abc-123", "PUMP 01")).toBe(
      "tpm-rca://equipment/abc-123?tag=PUMP%2001"
    );
  });

  it("builds a payload without a tag", () => {
    expect(equipmentQrValue("abc-123")).toBe("tpm-rca://equipment/abc-123");
  });

  it("round-trips: parse extracts the id from a generated payload", () => {
    const value = equipmentQrValue("xyz-999", "M-9");
    expect(parseEquipmentQr(value)).toBe("xyz-999");
  });

  it("returns null for a non-QR string (e.g. a plain tag)", () => {
    expect(parseEquipmentQr("PUMP-001")).toBeNull();
  });

  it("is case-insensitive on the scheme and trims whitespace", () => {
    expect(parseEquipmentQr("  TPM-RCA://equipment/ID42  ")).toBe("ID42");
  });
});
