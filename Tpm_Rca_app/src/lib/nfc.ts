import { equipmentQrValue } from "../components/QrCode";

/** True when the Web NFC API (`NDEFReader`) is available in this context. */
export function nfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/** The payload written to / read from an equipment NFC tag. */
export function nfcEquipmentPayload(id: string, tag?: string | null): string {
  return equipmentQrValue(id, tag);
}

/**
 * Writes the canonical equipment payload onto a physical NFC tag using the
 * Web NFC `NDEFReader.write` method. Resolves when the operator taps the tag,
 * rejects if the device has no NFC or the write is cancelled.
 */
export async function writeEquipmentNfcTag(
  id: string,
  tag?: string | null
): Promise<string> {
  const Ndef = (window as unknown as { NDEFReader?: new () => any }).NDEFReader;
  if (!Ndef) {
    throw new Error(
      "NFC is not supported on this device/browser. Use a QR tag or pick from the list."
    );
  }
  const payload = nfcEquipmentPayload(id, tag);
  const reader = new Ndef();
  await reader.write({
    records: [{ recordType: "text", data: payload }],
  });
  return payload;
}
