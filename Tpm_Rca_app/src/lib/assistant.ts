// Offline-first assistant "brain" for Ruca.
//
// The app is offline-first, so the assistant works with no network: it answers
// from a built-in knowledge base keyed on the current page and common keywords.
// If a pluggable LLM provider is configured later (see ROADMAP #1), this module
// is the single seam to swap in a real model — the UI stays the same.

export interface AssistantTip {
  title: string;
  body: string;
}

export interface AssistantPage {
  label: string;
  tips: AssistantTip[];
}

const PAGE_KNOWLEDGE: Record<string, AssistantPage> = {
  dashboard: {
    label: "Dashboard",
    tips: [
      { title: "Read the KPIs", body: "Availability, MTTR, MTBF and open downtime are computed live from your downtime records. No data yet? Log a downtime event first." },
      { title: "OEE", body: "OEE = Availability × Performance × Quality. Performance and quality default to 100% until you feed in production counts." },
      { title: "Drill down", body: "Click into Equipment, Downtime or RCA from the sidebar to act on what the charts show." },
    ],
  },
  equipment: {
    label: "Equipment",
    tips: [
      { title: "Add or import", body: "Add assets one at a time, or import a bulk list with the CSV import wizard (a template is provided)." },
      { title: "QR tags", body: "Each asset has a QR code you can download and print. Scan it with the camera or paste its value to jump straight to the asset." },
      { title: "Cost fields", body: "Set cost_per_hour and asset_value to unlock downtime-cost and ROI figures on the Financials page." },
    ],
  },
  hierarchy: {
    label: "Hierarchy",
    tips: [
      { title: "Plant structure", body: "Model plants → areas → equipment with parent/child relationships so roll-ups and reports make sense." },
    ],
  },
  downtime: {
    label: "Downtime",
    tips: [
      { title: "Log fast", body: "Use voice dictation (mic icon), scan an NFC/QR tag to pick the asset, or resume an offline draft — no typing required." },
      { title: "Loss categories", body: "Breakdown, Setup, Minor Stoppage and Speed Loss drive the Pareto and reliability analytics." },
      { title: "Close events", body: "Set an end time to compute duration and free the asset. Open events pulse red on the list." },
      { title: "Offline drafts", body: "Save a draft any time; it stays on this device and you can submit it later, even with no connection." },
    ],
  },
  rca: {
    label: "RCA",
    tips: [
      { title: "Build the tree", body: "Add cause nodes and gates (AND/OR) to map how a failure happened, then add CAPA actions to close it out." },
      { title: "Ruca coach", body: "On an equipment view the coach suggests likely failure modes and CAPA from your downtime history." },
    ],
  },
  capa: {
    label: "CAPA",
    tips: [
      { title: "Link to RCA", body: "CAPA actions attach to an investigation so corrective/preventive work is traceable to its root cause." },
      { title: "Track to closure", body: "Set owner, priority and due date; move status to Closed when verified." },
    ],
  },
  pm: {
    label: "PM Scheduler",
    tips: [
      { title: "Schedule PM", body: "Create preventive tasks with a frequency and next due date; complete them to roll the schedule forward." },
      { title: "Attachments", body: "Attach procedures or photos to a PM task so technicians have everything on the floor." },
    ],
  },
  tasks: {
    label: "Tasks",
    tips: [
      { title: "Your work", body: "Personal and assigned tasks with due dates and status live here — your daily to-do." },
    ],
  },
  timeline: {
    label: "Timeline",
    tips: [
      { title: "Unified history", body: "A single chronological view across downtime, PM and RCA events for an asset or the whole plant." },
    ],
  },
  audit: {
    label: "Audit",
    tips: [
      { title: "Traceability", body: "Every create/update/delete is logged with who and when. Use it for compliance and investigations." },
    ],
  },
  fmea: {
    label: "FMEA",
    tips: [
      { title: "Risk ranking", body: "Severity × Occurrence × Detection = RPN. Tackle the highest RPN failure modes first." },
    ],
  },
  cbm: {
    label: "CBM",
    tips: [
      { title: "Condition-based", body: "Set thresholds so maintenance triggers on condition (e.g. vibration/temperature) rather than calendar time." },
    ],
  },
  knowledge: {
    label: "Knowledge",
    tips: [
      { title: "Tribal knowledge", body: "Capture how-you-actually-fixed-it notes and photos per asset so expertise doesn't walk out the door." },
    ],
  },
  financials: {
    label: "Financials",
    tips: [
      { title: "Cost of downtime", body: "Downtime $ = duration × cost_per_hour. Set cost_per_hour on equipment to see the real impact." },
    ],
  },
  inventory: {
    label: "Inventory",
    tips: [
      { title: "Spares", body: "Track spare parts and stock so PM and repairs aren't blocked waiting on a component." },
    ],
  },
  workorders: {
    label: "Work Orders",
    tips: [
      { title: "Jobs", body: "Create and manage work orders linked to equipment and tasks." },
    ],
  },
  timesheets: {
    label: "Timesheets",
    tips: [
      { title: "Labour", body: "Log time against work so labour cost and utilisation are visible." },
    ],
  },
  schedule: {
    label: "Schedule",
    tips: [
      { title: "Plan", body: "Calendar view of PM, tasks and downtime to plan the week." },
    ],
  },
  reports: {
    label: "Reports",
    tips: [
      { title: "Export", body: "Generate and export reports (CSV/PDF) for management and audits." },
    ],
  },
  sync: {
    label: "Sync",
    tips: [
      { title: "Back up first", body: "Create a backup before any restore or sync. Backups are portable copies next to the database." },
      { title: "PostgreSQL", body: "Configure a PostgreSQL URL to push/pull with a central server. Sync is opt-in and two-way." },
      { title: "Peer (LAN)", body: "No server? Export a snapshot and merge it on another install on the same network. Login and server config stay local." },
    ],
  },
  users: {
    label: "Users",
    tips: [
      { title: "Roles", body: "Admins manage users and roles (Admin / Engineer / Technician / Viewer). Permissions gate which modules appear." },
    ],
  },
  about: {
    label: "About",
    tips: [
      { title: "How it runs", body: "A Tauri desktop app: React frontend → Rust commands → local SQLite, with optional sync to Postgres or a LAN peer." },
    ],
  },
};

// Keyword → answer rules, evaluated in order. Offline and dependency-free.
interface Rule {
  keywords: string[];
  answer: string;
}

const RULES: Rule[] = [
  {
    keywords: ["architecture", "tech stack", "app run", "stack", "built with", "how it's built"],
    answer:
      "TPM-RCA is a Tauri desktop app. The React/TypeScript UI calls Rust backend commands, which read and write a local SQLite database — so it works fully offline. Sync to PostgreSQL or a LAN peer is an optional, explicit action.",
  },
  {
    keywords: ["offline", "no internet", "connection"],
    answer:
      "It's offline-first. All data lives in a local SQLite file; the app keeps working with no network. Changes can be synced later when a connection is available.",
  },
  {
    keywords: ["qr", "scan", "camera", "nfc", "tag"],
    answer:
      "Open the tag scanner from Downtime (Scan Tag) or Equipment. You can tap an NFC tag, point the camera at a QR code, or paste a tpm-rca://equipment/<id> value. All three resolve to the same asset.",
  },
  {
    keywords: ["voice", "speech", "dictate", "microphone"],
    answer:
      "On the Downtime form, tap the mic on the Title or Description field and speak. Note that speech recognition needs a Chromium-based browser with permission — it may be unavailable in some webviews.",
  },
  {
    keywords: ["draft", "save later"],
    answer:
      "While logging downtime, tap 'Save draft'. Drafts are stored on this device and can be resumed and submitted later, even offline.",
  },
  {
    keywords: ["sync", "postgres", "server"],
    answer:
      "On the Sync page: configure a PostgreSQL URL, then Push/Pull. Or use Peer (LAN) sync to export a snapshot and merge it on another install — no server required.",
  },
  {
    keywords: ["backup", "back up", "restore", "export data"],
    answer:
      "On the Sync page use Backup & Restore. Backups are full portable copies of your local database saved next to the data file. Restore replaces current data, so back up first.",
  },
  {
    keywords: ["rca", "root cause", "investigation"],
    answer:
      "Open RCA, start an investigation for an asset, and build a cause tree with AND/OR gates. The Ruca coach suggests failure modes and CAPA from history.",
  },
  {
    keywords: ["capa", "action", "corrective"],
    answer:
      "CAPA actions live under an RCA investigation. Give each an owner, priority and due date, then mark it Closed when verified.",
  },
  {
    keywords: ["fmea", "rpn", "risk"],
    answer:
      "FMEA ranks failure modes by RPN = Severity × Occurrence × Detection (1–10 each). Focus on the highest RPN first.",
  },
  {
    keywords: ["oee", "mttr", "mtbf", "kpi", "availability"],
    answer:
      "The Dashboard computes Availability, MTTR and MTBF live from downtime records. OEE adds Performance and Quality (defaulting to 100% until production data is added).",
  },
  {
    keywords: ["import", "csv", "bulk"],
    answer:
      "On Equipment, use the CSV import wizard. Download the template to match the expected columns, preview, then import.",
  },
  {
    keywords: ["user", "role", "permission", "login", "password"],
    answer:
      "Admins manage users and roles on the Users page. Roles (Admin/Engineer/Technician/Viewer) control which modules appear in the sidebar.",
  },
  {
    keywords: ["tour", "guide", "help", "start"],
    answer:
      "Press '?' any time, or open Help from the sidebar footer to replay the guided tour and search tips.",
  },
  {
    keywords: ["theme", "dark", "light", "language"],
    answer:
      "Toggle dark/light mode and switch the interface language from the sidebar footer.",
  },
];

const FALLBACK =
  "I can help with any module. Try asking about logging downtime, scanning QR/NFC tags, voice entry, RCA, CAPA, FMEA, sync/backup, or how the app runs. You can also press '?' for the full help guide.";

function scoreRule(rule: Rule, q: string): number {
  return rule.keywords.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
}

/** Returns contextual tips for a page (empty array if unknown). */
export function tipsForPage(page?: string): AssistantTip[] {
  if (!page) return [];
  return PAGE_KNOWLEDGE[page]?.tips ?? [];
}

export function pageLabel(page?: string): string {
  if (!page) return "the app";
  return PAGE_KNOWLEDGE[page]?.label ?? page;
}

/** Answers a free-text question using the offline knowledge base. */
export function answerQuestion(question: string, page?: string): string {
  const q = question.trim().toLowerCase();
  if (!q) return FALLBACK;

  // Page-scoped tips take priority if the question is vague and a page is set.
  const pageTips = tipsForPage(page);
  if (pageTips.length && (q.length < 12 || q.includes("help") || q.includes("how") || q.includes("do") || q.includes("use") || q.includes("tip"))) {
    const match = pageTips.find((t) =>
      q.split(/\s+/).some((w) => w.length > 3 && t.title.toLowerCase().includes(w))
    );
    if (match) return `${match.title}: ${match.body}`;
  }

  let best: { rule: Rule; score: number } | null = null;
  for (const rule of RULES) {
    const s = scoreRule(rule, q);
    if (s > 0 && (!best || s > best.score)) best = { rule, score: s };
  }
  return best ? best.rule.answer : FALLBACK;
}

export const SUGGESTED_QUESTIONS = [
  "How does this app run?",
  "How do I scan a QR or NFC tag?",
  "How do I log downtime offline?",
  "How does sync & backup work?",
];

export interface LlmConfig {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
  apiKey: "",
};

export async function getLlmConfig(): Promise<LlmConfig> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const cfg = await invoke<LlmConfig>("get_llm_config");
    return { ...DEFAULT_LLM_CONFIG, ...cfg };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

/**
 * Asks the LLM for an answer. Falls back to the offline knowledge base
 * whenever the model is not configured or unreachable, so the assistant
 * always answers something useful.
 */
export async function askRuca(
  question: string,
  page?: string,
  history?: ChatMessage[],
): Promise<string> {
  let llmAnswer: string | undefined;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const cfg = await invoke<LlmConfig>("get_llm_config");
    if (cfg.enabled) {
      llmAnswer = await invoke<string>("ask_llm", {
        message: question,
        page: page ?? null,
        history: history ?? [],
      });
    }
  } catch {
    // Model not configured or unreachable → fall through to the KB.
  }
  return (llmAnswer && llmAnswer.trim()) || answerQuestion(question, page);
}
