import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import NfcTagWriter from "../components/NfcTagWriter";

const writeSpy = vi.fn((_arg?: unknown) => Promise.resolve());

class FakeNdef {
  write = writeSpy;
}

describe("NfcTagWriter (NFC provisioning)", () => {
  beforeEach(() => {
    writeSpy.mockClear();
    (window as unknown as { NDEFReader?: unknown }).NDEFReader = FakeNdef;
  });
  afterEach(() => {
    delete (window as unknown as { NDEFReader?: unknown }).NDEFReader;
    cleanup();
  });

  it("writes the canonical equipment payload when the operator taps a tag", async () => {
    render(<NfcTagWriter id="abc-123" tag="PMP-01" />);

    const button = screen.getByRole("button", { name: /write nfc tag/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await screen.findByText(/tag written/i);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const arg = writeSpy.mock.calls[0][0] as { records: { data: string }[] };
    expect(arg.records[0].data).toBe("tpm-rca://equipment/abc-123?tag=PMP-01");
  });

  it("shows unsupported state and disables the button without NFC", () => {
    delete (window as unknown as { NDEFReader?: unknown }).NDEFReader;
    render(<NfcTagWriter id="x" />);
    expect(screen.getByText(/not supported here/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /write nfc tag/i })).toBeDisabled();
  });
});
