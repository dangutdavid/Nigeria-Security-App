# Build Progress

Living progress tracker for the Nigeria Safety & Security Platform, mapped to the MVP Audit
Checklist. Update this file at the end of each working session.

**Last updated:** 2026-06-11

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started

---

## MVP audit checklist status

### Core workflows (P0)

| Area | Status | Notes |
| --- | --- | --- |
| Agency selector & tenant routing | ✅ | Public landing routes to FRSC / Police / VIO sign-in. |
| Officer authentication & profiles | 🟡 | PIN-based auth with seeded officers per agency. Backend auth pending api-server. |
| Role-based permissions (RBAC) | ✅ | Single source of truth in `lib/permissions.ts`; user mgmt + data scoped to agency. |
| Citizen stolen-vehicle reporting | ✅ | Submit → **case reference (STV-YYYY-NNNN)** → public **Track a Report** screen. |
| Stolen-vehicle workflow & audit trail | ✅ | Stages new → acknowledged → investigating → recovered / false alarm, each logged with who/when. |
| FRSC crash reporting | ✅ | 5-step wizard (type/severity, location+GPS, victims, vehicles, evidence). |
| Case assignment | ✅ | Supervisor/commander assignment modal on case detail. |
| Cross-agency referrals | ✅ | Shared referral data layer, inbox screen, "Refer to X" on detail screens, unread badge. |

### Supporting features (P1)

| Area | Status | Notes |
| --- | --- | --- |
| VIO vehicle inspection / lookup | ✅ | Inspections, certificates, plate lookup. |
| License-plate flags (cross-agency) | ✅ | Theft registry + open referrals surfaced in lookup / vehicle check / new inspection. |
| Duty session & patrol logs | ✅ | Agency-agnostic patrol log reused across FRSC/Police/VIO. |
| Offline mode & sync | 🟡 | AsyncStorage persistence + pending-sync flag + sync banner. No real server sync yet. |
| Location sharing & map | ✅ | Live incident map with severity/type filters; radius-based theft alerts. |
| Analytics & hotspots | 🟡 | FRSC analytics rich; per-agency police/VIO analytics are slim. |
| Document generation (reports/certificates) | ⬜ | Formal PDF/QR report generation not yet built. |

### Security & operations (P2 / non-negotiables)

| Area | Status | Notes |
| --- | --- | --- |
| Per-case audit trail | 🟡 | Incident timelines + theft status history done. No global audit log yet. |
| Encryption of local data | ⬜ | AsyncStorage is currently unencrypted. |
| API security (JWT, rate limit, tenant scope) | ⬜ | Pending api-server backend. |
| Backups & retention policy | ⬜ | Not defined. |
| Automated testing | ⬜ | No unit/integration/e2e suite yet. |
| Payments / partner portals | ⬜ | Out of MVP scope. |

---

## Build log

### 2026-07-12
- **Pulled the GitHub backend update into the workspace.** Merged ~37 commits from
  `dangutdavid/Nigeria-Security-App` `main`: real backend (auth with refresh rotation,
  Postgres persistence via Drizzle migrations, notifications/push, evidence, audit and ops
  routes), backend-wired mobile flows, admin and civil-defence sections, an emergency screen,
  EAS build config, and Vitest test suites.
- Conflicting files (theft context, track-report, stolen-alerts, report-theft, root layout,
  README) resolved in favor of the GitHub backend-wired versions; local-only files
  (PROGRESS.md, replit.md, agent memory) preserved.
- Aligned the workspace `@types/react` catalog to the mobile app's Expo-pinned ~19.1.x so a
  single version exists workspace-wide (two versions broke mockup-sandbox typechecking).
- `pnpm install` + full workspace typecheck pass; Expo app and API server verified running.

### 2026-06-11
- **Citizen stolen-vehicle loop completed (P0).** Added a human-readable case reference
  (`STV-YYYY-NNNN`) generated per year, an additive workflow `stage`
  (new / acknowledged / investigating) layered on top of the existing
  `active / recovered / false_alarm` status (semantics unchanged), and a per-case `history`
  audit trail (who changed what, when).
- New public **Track a Report** screen (`app/track-report.tsx`): look up by reference, see a
  friendly status banner, vehicle summary, and a full case timeline. Linked from the landing
  page and from the report success screen (which now shows the reference).
- Police **Stolen Vehicle Alerts** screen now shows the reference + current stage and exposes
  **Acknowledge** / **Start Investigation** actions alongside Recovered / False Alarm, stamping
  the officer + agency into the audit trail.
- Added project **README.md** and this **PROGRESS.md**.

### Earlier
- RBAC core, cross-agency referrals, plate-flag integration, and Police/VIO profile parity tools
  (manage officers, duty log, analytics, referrals inbox).
- Full FRSC field-operations app: crash-report wizard, live map, case list/detail, alerts,
  analytics, user management, vehicle lookup, patrol log, change PIN, offline persistence.

---

## Next candidates

1. Per-agency analytics depth (police/VIO computed dashboards).
2. Document generation — formal crash/theft/inspection reports with QR verification.
3. Global audit log screen for supervisors/commanders.
4. Real sync against the `api-server` backend (replace AsyncStorage seam).
