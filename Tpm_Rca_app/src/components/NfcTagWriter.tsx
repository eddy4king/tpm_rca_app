import { useState } from "react";
import { Radio, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "./ui";
import { nfcSupported, writeEquipmentNfcTag } from "../lib/nfc";

interface NfcTagWriterProps {
  id: string;
  tag?: string | null;
}

/**
 * Provisions a physical NFC tag for an asset so it can later be tapped in the
 * shop-floor scanner. Writes the same `tpm-rca://equipment/<id>` payload the
 * scanner reads, keeping NFC and QR interchangeable.
 */
export default function NfcTagWriter({ id, tag }: NfcTagWriterProps) {
  const [state, setState] = useState<"idle" | "writing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const supported = nfcSupported();

  async function handleWrite() {
    setState("writing");
    setMessage(null);
    try {
      const written = await writeEquipmentNfcTag(id, tag);
      setState("done");
      setMessage(`Tag written: ${written}`);
    } catch (err: unknown) {
      setState("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <Radio className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-slate-700">NFC Tag</span>
        {supported ? (
          <span className="text-xs text-emerald-600">supported</span>
        ) : (
          <span className="text-xs text-slate-400">not supported here</span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Tap an empty NFC tag to this device to write the asset id. The same tag
        can then be scanned hands-free on the shop floor.
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleWrite}
        disabled={state === "writing" || !supported}
      >
        {state === "writing" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Radio className="w-4 h-4" />
        )}
        {state === "writing" ? "Hold tag to device…" : "Write NFC tag"}
      </Button>

      {state === "done" && (
        <div className="flex items-center gap-2 text-emerald-600 mt-3 text-sm">
          <CheckCircle2 className="w-4 h-4" /> {message}
        </div>
      )}
      {state === "error" && (
        <div className="flex items-center gap-2 text-red-600 mt-3 text-sm">
          <XCircle className="w-4 h-4" /> {message}
        </div>
      )}
      {state === "done" && (
        <button
          className="text-xs text-indigo-600 hover:underline mt-2 block"
          onClick={() => {
            setState("idle");
            setMessage(null);
          }}
        >
          Write another tag
        </button>
      )}
    </div>
  );
}
