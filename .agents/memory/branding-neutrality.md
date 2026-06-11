---
name: Country-neutral branding
description: The mobile platform must stay country-agnostic in launch/shared surfaces because it is intended for adoption beyond Nigeria.
---

# Country-neutral branding

Keep launch-facing and shared surfaces free of country-specific or single-agency branding.

**Why:** The owner foresees the system being adopted in other countries, so the splash, app name, and agency-selection screen must read as a generic multi-agency platform — not "FRSC" or "Nigeria"-specific.

**How to apply:**
- App name (`artifacts/mobile/app.json` `expo.name`) is "Safety & Security"; splash/icon/favicon use the neutral shield `assets/images/app-icon.png` on navy `#0F1B2D` — do not revert to the FRSC `icon.png`/green.
- The agency-selection screen (`app/index.tsx`) header is "Safety & Security" with a neutral Feather `shield`, footer "Official Field Operations System" — no "Nigeria"/"Federal Republic of Nigeria".
- Agency-specific branding (FRSC/NPF/VIO logos, colors) belongs only inside each agency's own group, never on the shared launch/selection layer.
- Nigeria-specific operational data (state/LGA lists) is still in use inside the app; this note is about branding, not that data.
