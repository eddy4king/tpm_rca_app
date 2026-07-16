# Roadmap — Competitive Differentiators (Features 1–7)

These features are planned to make TPM-RCA stronger than mainstream CMMS
tools (Fiix, UpKeep, MaintainX, eMaint). They build on our existing
strengths: **offline-first**, **zero-infrastructure**, **TPM/RCA focus**,
and **QR-native** asset workflows.

Priority order is roughly top-to-bottom; 1 and 2 are the biggest wedges.

---

## 1. AI RCA Coach ("Ruca" upgraded)

**Goal:** Turn the tour mascot into an active root-cause assistant instead of a
static text store.

**Why it beats CMMS:** Incumbents only store free-text. We suggest likely
failure modes, draft the RCA node tree, and surface recurring failures from
history.

**Proposed implementation:**
- Add a `services/ai.rs` (Rust) or a frontend `lib/rcaCoach.ts` that,
  given an equipment's downtime + RCA history, returns suggestions.
- LLM backend: pluggable provider (local model via `llama.cpp` for offline,
  or a configured cloud key). Keep it optional — app works without it.
- UI: a coach panel inside `RcaPage.tsx` (`components/RcaCoach.tsx`)
  that proposes CAPA actions and auto-seeds RCA nodes.
- Feed it from `get_all_downtime` + existing RCA tables.

**Files to touch:** `src-tauri/src/services/`, `src/pages/RcaPage.tsx`,
`src/components/RcaCoach.tsx`, `src/context/TourContext.tsx` (reuse mascot).

---

## 2. Reliability-Engineering Depth

**Goal:** Engineering analytics beyond work orders — FMEA, Pareto, Weibull/MTBF,
RUL estimates, condition-based triggers.

**Why it beats CMMS:** Competitors track tickets; few do reliability math. This
fits a TPM/RCA product perfectly.

**Proposed implementation:**
- `src/lib/reliability.ts`: Pareto, MTBF/MTTR trends (extend current
  `get_oee_metrics`), Weibull fitting, failure-rate curves.
- `components/ReliabilityPanel.tsx` + new charts in `DashboardPage.tsx`.
- FMEA template editor (`pages/FmeaPage.tsx` + `src-tauri` tables).
- Condition-based maintenance triggers tied to sensor thresholds / MTBF.

**Files to touch:** `src/lib/reliability.ts`, `src/components/*Chart.tsx`,
`src-tauri/src/commands/mod.rs` (metrics queries), new migrations.

---

## 3. Financial Visibility (Downtime $ / ROI)

**Goal:** Cost-per-hour downtime, lost-production $, maintenance cost vs asset
value, OEE→revenue impact.

**Why it beats CMMS:** Turns a "maintenance tool" into a "savings tool" — far
easier to sell up to management.

**Proposed implementation:**
- Add `cost_per_hour` / `asset_value` fields to equipment (migration).
- `lib/finance.ts` computes downtime cost, MTTR cost, maintenance spend ratio.
- Finance cards + export in `DashboardPage.tsx` and `EquipmentPage.tsx`.

**Files to touch:** migration, `src-tauri/src/commands/mod.rs`,
`src/lib/finance.ts`, dashboard/equipment UI.

---

## 4. Tribal-Knowledge Capture

**Goal:** "How we actually fixed this" notes, photos, operator tips per asset so
expertise doesn't leave when techs do.

**Why it beats CMMS:** Competitors treat history as structured fields; we make it a
living knowledge base.

**Proposed implementation:**
- Extend RCA/PM attachments (already partial in `PMSchedulePage`) to all
  modules; add a `knowledge_notes` table + `pages/KnowledgePage.tsx`.
- Operator-facing quick-note entry on the shop floor (offline drafts).
- Searchable, taggable by equipment + failure mode.

**Files to touch:** new migration, `src-tauri/src/commands/`,
`src/components/*`, shop-floor note UI.

---

## 5. Zero-Friction Shop-Floor Capture

**Goal:** Voice/log entry, one-tap downtime, camera→QR instant lookup (extend
existing QR), NFC, fully offline with auto-sync (already offline-first). Then add
**LAN/peer sync with no server** so a plant runs with zero IT.

**Why it beats CMMS:** Floor adoption is the #1 failure mode for CMMS; we remove
every tap.

**Proposed implementation:**
- Voice entry via Web Speech API → populate downtime form.
- NFC tag support alongside QR (`components/QrCode.tsx` + scanner).
- Peer/LAN sync mode in `src-tauri/src/sync/mod.rs` (mDNS + SQLite merge),
  in addition to the existing Postgres sync target.
- Offline draft persistence for downtime (currently a PRD gap).

**Files to touch:** `src-tauri/src/sync/mod.rs`, `DowntimePage.tsx`,
`QrCode.tsx`, `lib/csv.ts` (reuse parsers).

---

## 6. TPM Culture Features

**Goal:** OEE leaderboards per line, Kaizen/CIP suggestion tracking, operator
recognition. CMMS are engineer tools; TPM is a people system.

**Why it beats CMMS:** Drives the cultural adoption that pure CMMS never achieve.

**Proposed implementation:**
- `pages/LeaderboardPage.tsx` fed by existing OEE/MTTR metrics.
- `pages/SuggestionsPage.tsx` (Kaizen/CIP) with status workflow.
- Recognition badges in `UsersPage.tsx` / profile.

**Files to touch:** new migrations, `src-tauri/src/commands/`, new pages.

---

## 7. Open & Portable by Default

**Goal:** No per-seat subscription, no cloud lock-in, full export, self-hosted
sync target. Make "your data is yours" a headline feature.

**Why it beats CMMS:** Vendors monetize lock-in; we invert it.

**Proposed implementation:**
- Full data export (SQLite + CSV) already partially in `backup.rs` / export.
- Document self-hosting the Postgres sync target; add a Docker Compose file.
- "Portability report" showing exactly what leaves the device and where.

**Files to touch:** `src-tauri/src/commands/backup.rs`, `SyncPage.tsx`,
docs + `docker-compose.yml`.

---

## Suggested Build Order

1. **#1 AI RCA Coach** — highest differentiation, reuses mascot + history.
2. **#2 Reliability Depth** — high value, builds on existing metrics.
3. **#5 Shop-Floor Capture** — closes known PRD gaps, drives adoption.
4. **#3 Financial Visibility** — quick win, sells up the chain.
5. **#4 Tribal Knowledge** — strengthens retention/value.
6. **#6 TPM Culture** — adoption/engagement layer.
7. **#7 Open & Portable** — positioning/messaging + packaging polish.
