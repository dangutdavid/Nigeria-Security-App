---
name: Expo SDK native module version pinning
description: Expo native modules must match the SDK's bundledNativeModules.json or native builds crash.
---

# Expo SDK native module version pinning

Expo packages that ship native code must match the version the installed Expo SDK expects, listed
in `node_modules/expo/bundledNativeModules.json`. A mismatched major version compiles/bundles fine
on web (JS-only) but crashes or partially fails on native iOS/Android, because the JS and the
native module are out of sync.

**Symptom seen:** App worked on web but crashed / was partial on native. Cause was
`expo-clipboard` pinned to `^55.x` while SDK 54 expects `~8.0.8`. Fix: pin to the SDK's expected
version, `pnpm install`, then restart the Expo workflow.

**How to apply:**
- When a native Expo module misbehaves only on device (not web), check its version against
  `bundledNativeModules.json` first.
- After changing a native dependency, restart the workflow (`restart_workflow "artifacts/mobile: expo"`),
  which runs Expo with `--clear` (clears Metro cache). Stale "Unable to resolve module X" console
  errors with timestamps predating the restart are leftovers from the swap, not live failures.

**Why / caveats:**
- Do NOT run `expo install --fix` to fix one package — it would also bump pinned deps like
  `react-native-maps` (must stay `1.18.0` per the expo skill override) and catalog versions.
- Minor patch drift within a `~` range (e.g. expo `54.0.34` vs `~54.0.35`, expo-font, expo-router)
  is not native-breaking — leave it. Only major/native-ABI mismatches matter.
