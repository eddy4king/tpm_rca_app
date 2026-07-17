import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Camera, Upload, Trash2, X, Image as ImageIcon } from "lucide-react";
import { Modal, Button, Input } from "./ui";
import { useToast } from "../context/ToastContext";

export interface Photo {
  id: string;
  recordType: string;
  recordId: string;
  caption: string | null;
  data: string;
  createdAt: string | null;
}

interface PhotoCaptureProps {
  recordType: "downtime" | "rca" | string;
  recordId: string;
}

const MAX_DIM = 1024;

export default function PhotoCapture({ recordType, recordId }: PhotoCaptureProps) {
  const toast = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [viewing, setViewing] = useState<Photo | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadPhotos() {
    if (!recordId) return;
    try {
      const data = await invoke<Photo[]>("get_photos", {
        recordType,
        recordId,
      });
      setPhotos(data);
    } catch (err) {
      toast.error(String(err));
    }
  }

  useEffect(() => {
    setPhotos([]);
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, recordType]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => () => stopCamera(), []);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow access and try again."
          : String(err?.message || err)
      );
      setCameraOn(false);
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.7);
    stopCamera();
    await addPhoto(data);
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    await addPhoto(data);
  }

  async function addPhoto(data: string) {
    setLoading(true);
    try {
      const saved = await invoke<Photo>("add_photo", {
        recordType,
        recordId,
        caption: pendingCaption.trim() || null,
        data,
      });
      setPhotos((p) => [...p, saved]);
      setPendingCaption("");
      toast.success("Photo added");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function removePhoto(id: string) {
    try {
      await invoke("delete_photo", { id });
      setPhotos((p) => p.filter((x) => x.id !== id));
      setViewing(null);
      toast.success("Photo removed");
    } catch (err) {
      toast.error(String(err));
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">Photos</span>
          {photos.length > 0 && (
            <span className="text-xs text-slate-400">{photos.length}</span>
          )}
        </div>
      </div>

      {cameraOn ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          </div>
          <Input
            placeholder="Caption (optional)"
            value={pendingCaption}
            onChange={(e) => setPendingCaption(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={captureFromCamera} disabled={loading}>
              Capture
            </Button>
            <Button variant="secondary" onClick={stopCamera}>
              <X className="w-4 h-4" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewing(p)}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group"
              >
                <img src={p.data} alt={p.caption || "photo"} className="w-full h-full object-cover" />
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(p.id);
                  }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
            {photos.length === 0 && (
              <p className="col-span-full text-xs text-slate-400">
                No photos yet. Capture from camera or upload one.
              </p>
            )}
          </div>

          <Input
            placeholder="Caption for next photo (optional)"
            value={pendingCaption}
            onChange={(e) => setPendingCaption(e.target.value)}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={startCamera}>
              <Camera className="w-4 h-4" /> Camera
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFilePicked}
            />
          </div>
        </>
      )}

      {cameraError && <p className="text-xs text-red-600 mt-2">{cameraError}</p>}

      {viewing && (
        <Modal title="Photo" onClose={() => setViewing(null)} maxWidth="max-w-2xl">
          <div className="space-y-3">
            <img src={viewing.data} alt={viewing.caption || "photo"} className="w-full rounded-lg" />
            {viewing.caption && (
              <p className="text-sm text-slate-600">{viewing.caption}</p>
            )}
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => removePhoto(viewing.id)}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
