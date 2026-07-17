export interface KnowledgeNote {
  id: string;
  equipment_id: string | null;
  title: string;
  body: string | null;
  tags: string | null; // JSON-encoded string array
  category: string | null;
  author: string | null;
  attachments: string | null; // JSON-encoded string array
  is_draft: number;
  created_at: string | null;
  updated_at: string | null;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
