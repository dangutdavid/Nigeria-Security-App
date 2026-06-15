// Default (web / non-native) citizen report map.
// Metro resolves `CitizenReportMap.native.tsx` on iOS/Android (an interactive
// react-native-maps view) and this file everywhere else, so every agency map
// screen can import a single `CitizenReportMap` and get the right experience
// per platform. Web keeps the scrollable, fully tappable fallback list.
export { CitizenReportMapFallback as CitizenReportMap } from "./CitizenReportMapFallback";
export type { CitizenReportMapProps } from "./CitizenReportMapFallback";
