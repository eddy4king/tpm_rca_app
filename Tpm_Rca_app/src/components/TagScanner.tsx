import { useState, useEffect } from "react";
import { Wifi, QrCode, Radio } from "lucide-react";
import { Button, Input, Modal, Banner } from "./ui";
import { parseEquipmentQr } from "./QrCode";

interface TagScannerProps {
  open: boolean;
  equipment: { id: string; tag_number: string | null; name: string | null }[];
  onClose: () => void;
  onSelect: (equipmentId: string) => void;
}

function ndefSupported(): boolean {
  return "NDEFReader" in window;
}

/**
 * Shop-floor tag capture. Tries Web NFC first (operator taps a physical tag on
 * a supported device) and always allows pasting/scanning a QR payload. Both
 * decode to the same `tpm-rca://equipment/<id>` scheme, so a tapped tag and a
 * scanned QR are interchangeable.
 */
export default function TagScanner({ open, equipment, onClose, onSelect }: TagScannerProps) {
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  async function startNfc() {
    setError(null);
    // NDEFReader is only available in secure contexts on Chromium-based mobile.
    const Ndef = (window as unknown as { NDEFReader?: new () => any }).NDEFReader;
    if (!Ndef) {
      setError("NFC is not supported on this device/browser. Use QR paste or pick from the list.");
      return;
    }
    try {
      const reader = new Ndef();
      setListening(true);
      setStatus("Tap an equipment tag to this device…");
      const abort = new AbortController();
      reader.addEventListener(
        "reading",
        (e: any) => {
          const record = e.message.records[0];
          if (!record) return;
          const decoder = new TextDecoder();
          const text = decoder.decode(record.data);
          handleValue(text);
        },
        { signal: abort.signal }
      );
      await reader.scan({ signal: abort.signal });
    } catch (err: any) {
      setListening(false);
      setError(String(err?.message || err));
    }
  }

  function handleValue(raw: string) {
    const id = parseEquipmentQr(raw);
    if (id) {
      const exists = equipment.some((e) => e.id === id);
      if (exists) {
        setStatus("Tag recognised — selecting equipment.");
        onSelect(id);
        onClose();
        return;
      }
      setError("Tag decoded but no matching equipment in this database.");
      return;
    }
    setError("Unrecognised tag. Expected a tpm-rca://equipment/<id> value.");
  }

  function submitPaste() {
    if (!paste.trim()) return;
    handleValue(paste.trim());
  }

  useEffect(() => {
    if (!open) {
      setPaste("");
      setStatus(null);
      setError(null);
      setListening(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal title="Scan Equipment Tag" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Identify the asset hands-free. NFC and QR both resolve to the same equipment id.
        </p>

        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">NFC</span>
            {ndefSupported() ? (
              <span className="text-xs text-emerald-600">supported</span>
            ) : (
              <span className="text-xs text-slate-400">not supported here</span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={startNfc}
            disabled={listening || !ndefSupported()}
          >
            <Wifi className="w-4 h-4" /> {listening ? "Listening…" : "Tap to scan NFC"}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">QR / manual</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Paste tpm-rca://equipment/…"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPaste()}
            />
            <Button onClick={submitPaste}>Decode</Button>
          </div>
        </div>

        {status && !error && (
          <Banner tone="success">{status}</Banner>
        )}
        {error && <Banner tone="error">{error}</Banner>}

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Or pick from {equipment.length} assets
          </p>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y">
            {equipment.map((eq) => (
              <button
                key={eq.id}
                onClick={() => {
                  onSelect(eq.id);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
              >
                <span className="font-mono text-slate-500">{eq.tag_number}</span>{" "}
                <span className="text-slate-800">{eq.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
