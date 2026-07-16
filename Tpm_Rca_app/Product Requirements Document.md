Product Requirements Document (PRD)

Project: TPM RCA Desktop App – a Vite + React TypeScript front‑end with a Tauri (Rust) backend, used for tracking equipment, downtime, root‑cause analysis (RCA) and related TPM (Total Productive Maintenance) activities.

1. Vision & Goals

Goal Success Metric

Centralised TPM data hub – replace spreadsheets/manual logs with a single desktop application. > 80 % of existing TPM data migrated within 3 months.

Standardised RCA workflow – guide users through consistent root‑cause steps. 30 % reduction in mean‑time‑to‑repair (MTTR) after 6 months.

Improved visibility – real‑time dashboards for downtime, equipment health, and pending actions. Stakeholder satisfaction score ≥ 4/5 (quarterly survey).

Offline‑first operation – allow shop‑floor use without network, auto‑sync when online. < 5 % sync‑failure rate in field trials.

Scalable user management – role‑based permissions and bulk user onboarding. Ability to onboard > 200 users in a single batch without errors.

2. Target Users & Personas

Persona Needs

Line Operator Quick entry of downtime events; view equipment status; offline use.

Maintenance Engineer Access RCA templates; attach logs/photos; receive notifications.

TPM Manager Dashboard overview; export reports; assign RCA tasks; manage users.

IT / System Admin Deploy, backup, restore, integrate with corporate systems.

3. Core Features (MVP)

Feature Description Owner (Front‑end / Back‑end)

User Authentication Email/password login, JWT session, role assignment (Admin, Engineer, Operator). FE: React Context, login form. <br> BE: Tauri command exposing Rust auth lib (sqlite users).

Role‑Based Access Control (RBAC) UI elements hidden/disabled based on role; API guards. FE: role checks in components. <br> BE: middleware on Tauri commands.

Dashboard KPI widgets: current downtime %, open RCA count, equipment health summary. FE: Recharts/Chart.js, lazy‑loaded components.

Equipment Catalog List & detail view of equipment, searchable, QR‑code lookup. FE: searchable table, QR‑scanner component. <br> BE: SQLite queries.

Downtime Capture Form to log downtime event (equipment, start/end, cause). Auto‑save drafts locally. FE: Form with validation, draft storage in local DB. <br> BE: Endpoint to persist event.

RCA Wizard Multi‑step guided flow: select template → fill sections → attach files → submit. FE: Stepper component, file picker. <br> BE: Store RCA record + attachments.

Sync Engine Detect offline changes, queue them, resolve conflicts on reconnect. BE: Tauri sync module using SQLite + remote API stub (future).

Export / Reporting Export downtime & RCA data as CSV/Excel, filtered by date/range. FE: Export button, generate CSV client‑side.

Settings & Backup UI to export full SQLite DB (backup) and import (restore) with validation. FE: Backup/Restore dialogs. <br> BE: Tauri file I/O commands.

4. Nice‑to‑Have Enhancements (Post‑MVP)

Feature Value

Dark/Light theme toggle (persisted) Improves ergonomics on shop floor.

Internationalisation (i18n) Enables multilingual deployments.

Notification system (desktop toasts) Alerts for new RCA assignments, sync failures.

QR‑code generation for equipment tags Simplifies asset tagging.

Integration hooks (Jira, ServiceNow) Automates ticket creation from RCA.

Advanced analytics (trend charts, MTTR calculations) Data‑driven process improvement.

Guided tour / contextual help Reduces onboarding time for new operators.

Unit & integration test suite (Jest + cargo test) Guarantees stability as code grows.

5. Technical Requirements

Area Requirement

Platform Windows (x64) desktop via Tauri; future macOS/Linux optional.

Frontend Stack Vite, React 18, TypeScript, Tailwind CSS (existing), Recharts/Chart.js.

Backend Stack Rust 1.70+, Tauri API, SQLite (bundled), async‑std/Tokio for sync.

State Management React Context + useReducer for auth & global data; local SQLite for offline storage.

Security Store passwords salted+hashed (bcrypt). JWT stored in secure OS‑level storage.

Performance Initial load ≤ 2 s, UI interactions ≤ 150 ms.

Packaging Tauri bundler to produce installer (.msi or .exe).

Testing Jest + React Testing Library for UI; Rust cargo test for backend logic.

CI/CD GitHub Actions: lint, type‑check, build (frontend + Tauri), unit tests.

Versioning Semantic versioning, changelog generation.

6. Dependencies & Assumptions

- Existing SQLite schema is stable; migrations will be added for new tables (RCA, users, roles).

- No external authentication provider is needed for MVP; future SSO can be added later.

- Network connectivity is intermittent; sync engine must handle eventual consistency.

- Users have access to a webcam for QR scanning (optional).

7. Milestones & Timeline (8 weeks)

Week Milestone

1 Project kickoff, finalize schema changes, set up CI pipeline.

2 Implement authentication (login UI, backend auth, JWT).

3 RBAC enforcement, user management UI (admin).

4 Dashboard widgets & KPI calculations.

5 Equipment catalog + QR‑code scanner integration.

6 Downtime capture form + offline draft persistence.

7 RCA wizard (multi‑step) + attachment handling.

8 Sync engine, backup/restore, export reports, QA & bug‑fixes.

9 Beta build, user testing, gather feedback.

10 Final polish, documentation, release candidate.

8. Success Metrics (Post‑Release)

Metric Target

Adoption ≥ 70 % of TPM team active weekly within 1 month.

Data quality < 2 % duplicate or incomplete entries.

MTTR reduction 30 % drop vs baseline after 6 months.

Sync reliability < 5 % failed sync events per month.

User satisfaction Avg. rating ≥ 4.5/5 in post‑release survey.

9. Risks & Mitigations

Risk Impact Mitigation

Offline data loss High (critical data) Local SQLite with transaction log; automatic backup on app close.

Security breach (password storage) High Use bcrypt with proper salt; never store plaintext.

UI performance on low‑spec machines Medium Lazy load pages, keep assets lightweight, profile with DevTools.

Scope creep (adding many integrations early) Medium Prioritize MVP features; lock non‑essential items in backlog.

Tauri packaging issues on Windows Medium Use CI to test installer generation on each commit.

10. Open Questions (to be resolved early)

1. User data source – will the initial user list be imported from an existing system?

2. Sync target – is there a central API endpoint planned now, or will sync simply push to a shared network folder?

3. Notification channel – desktop toast vs system tray vs email – which is preferred?

4. QR hardware – rely on built‑in webcam or external scanner?

11. Approvals

Role Name

Product Owner –

Engineering Lead –

UX Designer –

QA Lead –

Prepared by: OpenCode AI (generated 2026‑06‑11)

Version: 1.0.0‑draft

---

## 12. Competitive Roadmap (Features 1–7)

To outpace mainstream CMMS tools (Fiix, UpKeep, MaintainX, eMaint), we lean
into existing strengths — **offline‑first**, **zero‑infrastructure**, **TPM/RCA
focus**, and **QR‑native** workflows — and add the differentiators below.
Full build notes, file targets and suggested order are in **`ROADMAP.md`**.

| # | Feature | One‑line differentiator |
|---|---------|--------------------------|
| 1 | **AI RCA Coach** ("Ruca" upgraded) | Suggests failure modes, drafts the RCA tree, surfaces recurring failures from history — not a static text box. |
| 2 | **Reliability‑Engineering Depth** | FMEA, failure Pareto, Weibull/MTBF, RUL estimates — engineering math incumbents skip. |
| 3 | **Financial Visibility** | Downtime $/hr, lost‑production $, maintenance‑vs‑asset cost — turns a cost tool into a savings tool. |
| 4 | **Tribal‑Knowledge Capture** | "How we fixed it" notes + photos per asset so expertise survives staff turnover. |
| 5 | **Zero‑Friction Shop‑Floor Capture** | Voice entry, one‑tap downtime, camera→QR/NFC lookup, LAN peer‑sync with no server. |
| 6 | **TPM Culture Features** | OEE leaderboards per line, Kaizen/CIP suggestions, operator recognition. |
| 7 | **Open & Portable by Default** | No per‑seat subscription, no lock‑in, full export, self‑hosted sync target. |

**Suggested build order:** 1 → 2 → 5 → 3 → 4 → 6 → 7.

End of Document