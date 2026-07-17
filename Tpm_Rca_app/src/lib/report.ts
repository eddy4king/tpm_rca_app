import { jsPDF } from "jspdf";

export interface PdfWo {
  wo_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  wo_type: string;
  equipment: string;
  assigned_to: string | null;
  due_date: string | null;
  approval_status: string;
}
export interface PdfLabor { person_name: string | null; minutes: number; rate: number | null; note: string | null; }
export interface PdfPart { part_number: string | null; qty: number; unit_cost: number | null; }

/** Generates and downloads a Work Order PDF. */
export function exportWorkOrderPdf(
  wo: PdfWo,
  labor: PdfLabor[],
  parts: PdfPart[],
  totalCost: number
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFontSize(18);
  doc.text("Work Order", 40, y);
  doc.setFontSize(11);
  doc.text(wo.wo_number, W - 40, y, { align: "right" });
  y += 8;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 24;

  const meta: [string, string][] = [
    ["Title", wo.title],
    ["Type", wo.wo_type],
    ["Status", wo.status.replace("_", " ")],
    ["Priority", wo.priority],
    ["Equipment", wo.equipment],
    ["Assigned To", wo.assigned_to || "—"],
    ["Due Date", wo.due_date || "—"],
    ["Approval", wo.approval_status],
  ];
  doc.setFontSize(10);
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, 140, y);
    y += 16;
  }
  if (wo.description) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Description", 40, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(wo.description, W - 80);
    doc.text(lines, 40, y + 14);
    y += 14 + lines.length * 12;
  }

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text("Labor", 40, y);
  doc.setFont("helvetica", "normal");
  y += 16;
  for (const l of labor) {
    const cost = ((l.minutes / 60) * (l.rate || 0)).toFixed(2);
    doc.text(`${l.person_name || "Unnamed"} — ${l.minutes} min${l.rate ? ` @ $${l.rate}/hr ($${cost})` : ""}`, 40, y);
    y += 14;
  }
  if (labor.length === 0) { doc.text("No labor logged.", 40, y); y += 14; }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Parts", 40, y);
  doc.setFont("helvetica", "normal");
  y += 16;
  for (const p of parts) {
    const cost = ((p.unit_cost || 0) * p.qty).toFixed(2);
    doc.text(`${p.part_number || "Part"} × ${p.qty}${p.unit_cost ? ` ($${p.unit_cost} ea, $${cost})` : ""}`, 40, y);
    y += 14;
  }
  if (parts.length === 0) { doc.text("No parts used.", 40, y); y += 14; }

  y += 14;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Cost: $${totalCost.toFixed(2)}`, 40, y);

  doc.save(`work-order-${wo.wo_number}.pdf`);
}
