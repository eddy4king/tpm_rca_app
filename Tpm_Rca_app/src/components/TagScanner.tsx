import { useState, useEffect, useRef } from "react";
import { Wifi, QrCode, Radio, Camera } from "lucide-react";
import jsQR from "jsqr";
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
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

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

  function stopCamera() {
    scanningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      scanningRef.current = true;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      scanLoop();
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow access and try again."
          : String(err?.message || err)
      );
      setCameraOn(false);
    }
  }

  function scanLoop() {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const decoded = jsQR(imageData.data, w, h);
          if (decoded?.data) {
            stopCamera();
            handleValue(decoded.data);
            return;
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
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
      setCameraError(null);
      setCameraOn(false);
      stopCamera();
    }
  }, [open]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-slate-700">Camera (QR)</span>
            </div>
            {cameraOn && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                scanning
              </span>
            )}
          </div>

          {cameraOn ? (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-dashed border-white/60 m-6 rounded-lg pointer-events-none" />
              </div>
              <Button variant="secondary" size="sm" className="w-full" onClick={stopCamera}>
                Stop camera
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={startCamera}
            >
              <Camera className="w-4 h-4" /> Scan QR with camera
            </Button>
          )}

          {cameraError && (
            <p className="text-xs text-red-600 mt-2">{cameraError}</p>
          )}
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
