export interface DowntimeDraft {
  id: string;
  savedAt: string;
  equipment_id: string;
  title: string;
  description: string;
  loss_category: string;
  start_time: string;
  reported_by: string;
}

const KEY = "tpm_downtime_drafts";

function read(): DowntimeDraft[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(drafts: DowntimeDraft[]) {
  localStorage.setItem(KEY, JSON.stringify(drafts));
}

export function loadDrafts(): DowntimeDraft[] {
  return read().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export function saveDraft(draft: Omit<DowntimeDraft, "id" | "savedAt">): DowntimeDraft {
  const full: DowntimeDraft = {
    ...draft,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  write([full, ...read()].slice(0, 25));
  return full;
}

export function deleteDraft(id: string) {
  write(read().filter((d) => d.id !== id));
}

export function clearDrafts() {
  write([]);
}
