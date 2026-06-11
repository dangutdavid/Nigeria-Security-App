---
name: Expo Router auth-guard logout race
description: Why sign-out must happen in an unguarded root route, not inside a guarded tab-group screen.
---

# Expo Router auth-guard logout race

Each agency tab group (`(tabs)`, `(police)`, `(vio)`) has a `_layout.tsx` auth guard of the
form `if (!user) return <Redirect href="/" />`. If a screen *inside* that group calls
`logout()` (which sets `user = null`) and *also* fires `router.replace("/logout")`, the two
navigations race: the declarative `<Redirect href="/">` fires the instant `user` becomes null,
conflicting with the imperative replace. On web this conflict makes logout appear to do nothing.

**Rule:** Do the actual sign-out from an *unguarded root route*, not from a guarded group screen.

**How to apply:**
- Guarded profile screens only show a confirm and then `router.replace("/logout")` — they must
  NOT call `logout()` themselves.
- `app/logout.tsx` is registered in the root Stack (outside all groups) and clears auth in a
  mount `useEffect(() => { void logout(); }, [])`. By the time auth clears, the group layout has
  already unmounted, so its Redirect can't stall the navigation.
- `logout()` in AuthContext is idempotent (`AsyncStorage.multiRemove` + `setUser(null)`), so a
  StrictMode double-invoke of the effect is harmless. (App has no `<StrictMode>` wrapper anyway.)

**Why:** Declarative `<Redirect>` in a guard reacts to state synchronously and competes with
imperative router calls; routing the sign-out through a route the guard doesn't protect removes
the competition entirely and behaves identically across all three agency groups.

**Related:** Cross-platform confirms use `utils/confirm.ts` (`confirmAction`) — `window.confirm`
on web (synchronous; react-native-web's `Alert.alert` button callbacks are unreliable) and
`Alert.alert` on native.
