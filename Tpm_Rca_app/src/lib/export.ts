// Lightweight client-side CSV export helpers.
//
// Works inside the Tauri webview by generating a Blob and triggering a
// download via a temporary anchor element — no extra Tauri plugins required.

export interface ExportColumn<T> {
  /** Object key to read from each row. */
  key: keyof T & string;
  /** Human-friendly column header. */
  label: string;
  /** Optional value formatter (e.g. map an id to a name, format a date). */
  format?: (value: T[keyof T], row: T) => string | number | null | undefined;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote if the cell contains a comma, quote, or newline.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Converts an array of rows into a CSV string. */
export function toCsv<T extends Record<string, any>>(
  rows: T[],
  columns: ExportColumn<T>[]
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        const value = c.format ? c.format(raw, row) : raw;
        return escapeCell(value);
      })
      .join(",")
  );
  return [header, ...body].join("\r\n");
}

/** Triggers a browser/webview download for the given text content. */
export function downloadFile(
  filename: string,
  content: string,
  mimeType = "text/csv;charset=utf-8;"
): void {
  // Prepend a UTF-8 BOM so Excel opens the file with correct encoding.
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release the object URL on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** Convenience: build a CSV from rows/columns and download it. */
export function exportToCsv<T extends Record<string, any>>(
  baseName: string,
  rows: T[],
  columns: ExportColumn<T>[]
): void {
  const csv = toCsv(rows, columns);
  downloadFile(`${baseName}_${timestamp()}.csv`, csv);
}
