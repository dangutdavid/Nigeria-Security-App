---
name: Theft report data model
description: Two-axis status/stage model for stolen-vehicle reports and its constraints
---

# Stolen-vehicle theft report model (mobile app, TheftReportContext)

The citizen stolen-vehicle report uses **two independent axes** — do not collapse them:

- `status`: `"active" | "recovered" | "false_alarm"` — the **source of truth for every filter**
  across the app (police alerts, plate flags, counts all check `status === "active"`).
- `stage`: `"new" | "acknowledged" | "investigating"` — an **additive** workflow axis layered on
  top, used only for display + the audit timeline. It does NOT affect filters.
- `history: TheftStatusEvent[]` — per-case audit trail (action, who, agency, when).
- `reference`: human-readable `STV-YYYY-NNNN`, looked up case-insensitively on the public
  Track-a-Report screen.

**Why:** stage was added without changing status semantics so all existing `status === "active"`
checks keep working. Merging stage into status (a tempting "simplification") would silently break
those filters.

**How to apply:**
- New code that filters/counts open reports must key off `status`, not `stage`.
- Older persisted records are backfilled by `normalizeReports` on load (synthesizes missing
  `reference`/`stage`/`history`); it scans existing refs first so backfilled sequences never
  collide with seeds. Any new persisted field needs the same backfill treatment.
- A cold deep-link `/track-report?ref=...` must wait for the provider to hydrate before searching
  (reports is `[]` until AsyncStorage loads, then always seeds non-empty) — otherwise it sticks on
  "No report found".
- **Future backend (api-server) note:** references are sequential/guessable and the public timeline
  exposes reporter/officer names — fine for the local AsyncStorage demo, but the server version
  should use non-enumerable references and redact `by`/reporter fields on public lookups.
