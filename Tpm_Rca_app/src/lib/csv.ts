// Minimal, dependency-free CSV parsing helpers.
//
// Sufficient for importing/parsing small CSV files inside the Tauri webview.
// Handles quoted fields, escaped quotes ("") and embedded commas/newlines.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Parses CSV text into headers and an array of row arrays. */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let started = false;

  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    started = true;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (started) {
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1) };
}

/** Normalizes a header into a comparable key (lowercased, alphanumerics only). */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}
