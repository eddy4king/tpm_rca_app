import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "./ui";

/**
 * Builds the canonical QR payload for a piece of equipment. Using a custom
 * scheme keeps the payload self-describing so a scanner/lookup can parse it.
 */
export function equipmentQrValue(id: string, tag?: string | null): string {
  const params = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  return `tpm-rca://equipment/${id}${params}`;
}

/** Extracts an equipment id from a scanned/typed QR payload, if present. */
export function parseEquipmentQr(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^tpm-rca:\/\/equipment\/([^?]+)/i);
  if (match) return match[1];
  return null;
}

interface QrCodeProps {
  value: string;
  /** Filename (without extension) used when downloading the PNG. */
  downloadName?: string;
  size?: number;
  label?: string;
}

export default function QrCode({
  value,
  downloadName = "qr-code",
  size = 160,
  label,
}: QrCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${downloadName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        className="p-3 bg-white rounded-xl border border-slate-200 inline-block"
      >
        <QRCodeCanvas value={value} size={size} level="M" includeMargin />
      </div>
      {label && <p className="text-xs font-mono text-slate-500 break-all text-center max-w-[200px]">{label}</p>}
      <Button variant="secondary" size="sm" onClick={handleDownload}>
        <Download className="w-3.5 h-3.5" /> Download PNG
      </Button>
    </div>
  );
}
