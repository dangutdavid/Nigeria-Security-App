import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIncidents, IncidentStatus, SeverityLevel, groupProbableCauses } from "@/context/IncidentContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { IncidentCard } from "@/components/IncidentCard";
import {
  NIGERIA_STATE_LGAS,
  ALL_STATE_NAMES,
  getLGAsForStates,
} from "@/data/nigeriaLGAs";

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------
type StatusFilterValue = IncidentStatus | "all" | "open";

const STATUS_FILTERS: Array<{ label: string; value: StatusFilterValue }> = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Submitted", value: "submitted" },
  { label: "Assigned", value: "assigned" },
  { label: "Review", value: "under_review" },
  { label: "Closed", value: "closed" },
];

const SEVERITY_FILTERS: Array<{ label: string; value: SeverityLevel | "all" }> = [
  { label: "All", value: "all" },
  { label: "Fatal", value: "fatal" },
  { label: "Serious", value: "serious" },
  { label: "Minor", value: "minor" },
];

// ---------------------------------------------------------------------------
// Location filter modal
// ---------------------------------------------------------------------------
interface LocationFilterProps {
  visible: boolean;
  selectedStates: string[];
  selectedLGAs: string[];
  onApply: (states: string[], lgas: string[]) => void;
  onClose: () => void;
}

function LocationFilterSheet({
  visible,
  selectedStates,
  selectedLGAs,
  onApply,
  onClose,
}: LocationFilterProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [draftStates, setDraftStates] = useState<string[]>(selectedStates);
  const [draftLGAs, setDraftLGAs] = useState<string[]>(selectedLGAs);
  const [activeState, setActiveState] = useState(selectedStates[0] ?? "");
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState("");

  const onShow = useCallback(() => {
    setDraftStates(selectedStates);
    setDraftLGAs(selectedLGAs);
    setActiveState(selectedStates[0] ?? "");
    setLocMsg("");
  }, [selectedStates, selectedLGAs]);

  const availableLGAs = useMemo(() => getLGAsForStates(activeState ? [activeState] : draftStates), [activeState, draftStates]);
  const selectedStateLabel = activeState || "Select a state";

  const toggleState = (s: string) => {
    setActiveState(s);
    setDraftStates([s]);
    setDraftLGAs([]);
  };

  const toggleLGA = (l: string) => {
    setDraftLGAs((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  };

  const handleNearMe = async () => {
    setLocating(true);
    setLocMsg("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocMsg("Location permission denied.");
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo?.region) {
        const detectedState = ALL_STATE_NAMES.find((s) => s.toLowerCase() === geo.region?.toLowerCase());
        if (detectedState) {
          if (!draftStates.includes(detectedState)) setDraftStates((prev) => [...prev, detectedState]);
          if (geo.subregion || geo.city) {
            const locality = (geo.subregion || geo.city || "").trim();
            const matchLGA = getLGAsForStates([detectedState]).find((l) => l.toLowerCase().includes(locality.toLowerCase()) || locality.toLowerCase().includes(l.toLowerCase()));
            if (matchLGA && !draftLGAs.includes(matchLGA)) setDraftLGAs((prev) => [...prev, matchLGA]);
          }
          setLocMsg(`Detected: ${detectedState}${geo.subregion ? ` › ${geo.subregion}` : ""}`);
        } else {
          setLocMsg(`Could not match region "${geo.region}" to a state.`);
        }
      } else {
        setLocMsg("Could not determine your state from GPS.");
      }
    } catch {
      setLocMsg("GPS error. Try again.");
    }
    setLocating(false);
  };

  const clearAll = () => {
    setDraftStates([]);
    setDraftLGAs([]);
    setActiveState("");
    setLocMsg("");
  };

  const apply = () => {
    onApply(draftStates, draftLGAs);
    onClose();
  };

  const totalSelected = draftStates.length + draftLGAs.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={onShow} onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Location Filter</Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={[styles.clearBtn, { color: colors.primary }]}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.gpsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="navigation" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.gpsTitle, { color: colors.text }]}>Use My Location</Text>
            {locMsg ? <Text style={[styles.gpsMsg, { color: colors.mutedForeground }]}>{locMsg}</Text> : <Text style={[styles.gpsMsg, { color: colors.mutedForeground }]}>Auto-detect your state &amp; LGA from GPS</Text>}
          </View>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <TouchableOpacity style={[styles.gpsBtn, { backgroundColor: colors.primary }]} onPress={handleNearMe}>
              <Text style={styles.gpsBtnText}>Detect</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="map" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>State{draftStates.length > 0 ? ` (${draftStates.length} selected)` : ""}</Text>
            </View>

            {draftStates.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesRow}>
                {draftStates.map((s) => (
                  <TouchableOpacity key={`state-${s}`} style={[styles.badge, { backgroundColor: colors.primary }]} onPress={() => toggleState(s)}>
                    <Text style={styles.badgeText}>{s}</Text>
                    <Feather name="x" size={11} color="#fff" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={() => {
              if (!activeState) setActiveState(ALL_STATE_NAMES[0]);
            }}>
              <Feather name="map" size={14} color={colors.mutedForeground} />
              <Text style={[styles.pickerText, { color: colors.text }]}>{selectedStateLabel}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <View style={styles.chipGrid}>
              {ALL_STATE_NAMES.map((s) => {
                const active = activeState === s;
                return (
                  <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]} onPress={() => toggleState(s)}>
                    {active && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {activeState && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="map-pin" size={14} color={colors.secondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Local Government{draftLGAs.length > 0 ? ` (${draftLGAs.length} selected)` : ""}</Text>
              </View>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{activeState}</Text>

              {draftLGAs.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesRow}>
                  {draftLGAs.map((l) => (
                    <TouchableOpacity key={`lga-${l}`} style={[styles.badge, { backgroundColor: colors.secondary }]} onPress={() => toggleLGA(l)}>
                      <Text style={styles.badgeText}>{l}</Text>
                      <Feather name="x" size={11} color="#fff" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {draftLGAs.length === 0 && (
                <View style={styles.quickRow}>
                  <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>Quick pick:</Text>
                  {(NIGERIA_STATE_LGAS.find((s) => s.name === activeState)?.lgas.slice(0, 5) ?? []).map((l) => (
                    <TouchableOpacity key={`quick-${activeState}-${l}`} style={[styles.quickChip, { borderColor: colors.secondary }]} onPress={() => toggleLGA(l)}>
                      <Text style={[styles.quickChipText, { color: colors.secondary }]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.chipGrid}>
                {availableLGAs.map((l) => {
                  const active = draftLGAs.includes(l);
                  return (
                    <TouchableOpacity key={l} style={[styles.chip, { backgroundColor: active ? colors.secondary : colors.muted, borderColor: active ? colors.secondary : colors.border }]} onPress={() => toggleLGA(l)}>
                      {active && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                      <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {totalSelected > 0 && <Text style={[styles.footerHint, { color: colors.mutedForeground }]}>{draftStates.length > 0 ? `${draftStates.length} state${draftStates.length > 1 ? "s" : ""}` : ""}{draftStates.length > 0 && draftLGAs.length > 0 ? " · " : ""}{draftLGAs.length > 0 ? `${draftLGAs.length} LGA${draftLGAs.length > 1 ? "s" : ""}` : ""} selected</Text>}
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={apply}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function CasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { incidents } = useIncidents();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedLGAs, setSelectedLGAs] = useState<string[]>([]);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    const nextStatus = typeof params.status === "string" ? params.status : null;
    const nextSeverity = typeof params.severity === "string" ? params.severity : null;
    if (nextStatus && ["all", "open", "submitted", "assigned", "under_review", "closed"].includes(nextStatus)) {
      setStatusFilter(nextStatus as StatusFilterValue);
    }
    if (nextSeverity && ["all", "fatal", "serious", "minor"].includes(nextSeverity)) {
      setSeverityFilter(nextSeverity as SeverityLevel | "all");
    }
  }, [params.status, params.severity]);

  const filtered = incidents.filter((incident) => {
    if (mineOnly && incident.reportedBy !== user?.id) return false;
    if (todayOnly) {
      const d = new Date(incident.dateTime);
      const now = new Date();
      if (d.toDateString() !== now.toDateString()) return false;
    }
    if (query && !`${incident.id} ${incident.title} ${incident.location} ${incident.lga} ${incident.state}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "open") {
        if (["closed"].includes(incident.status)) return false;
      } else if (incident.status !== statusFilter) {
        return false;
      }
    }
    if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
    if (selectedStates.length > 0 && !selectedStates.includes(incident.state)) return false;
    if (selectedLGAs.length > 0 && !selectedLGAs.includes(incident.lga)) return false;
    return true;
  });

  const locationActive = selectedStates.length > 0 || selectedLGAs.length > 0;
  const bottomPad = insets.bottom + 24;
  const activeFiltersCount =
    (statusFilter === "all" ? 0 : 1) +
    (severityFilter === "all" ? 0 : 1) +
    (mineOnly ? 1 : 0) +
    (todayOnly ? 1 : 0) +
    selectedStates.length +
    selectedLGAs.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cases</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Browse and manage incidents</Text>
        </View>
      </View>
      <View style={[styles.headerActionRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerActionsTop}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.secondary }]} onPress={() => router.push("/report")} activeOpacity={0.85}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.headerBtnText}>Add incident</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterSummaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => setLocationModalVisible(true)} activeOpacity={0.85}>
            <Feather name="sliders" size={16} color={colors.text} />
            <Text style={[styles.filterSummaryText, { color: colors.text }]}>{activeFiltersCount > 0 ? `${activeFiltersCount} filters` : "Filters"}</Text>
          </TouchableOpacity>
        </View>
        {locationActive && (
          <View style={styles.locationSummaryRow}>
            <Text style={[styles.locationSummaryText, { color: colors.mutedForeground }]}>
              {selectedStates.length > 0 ? `State: ${selectedStates.join(", ")}` : "State: any"}
              {selectedLGAs.length > 0 ? ` · LGA: ${selectedLGAs.join(", ")}` : ""}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedStates([]); setSelectedLGAs([]); }} activeOpacity={0.8}>
              <Text style={[styles.locationClearText, { color: colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={[styles.filterMeta, { color: colors.mutedForeground }]}>
          {filtered.length} of {incidents.length} cases shown
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          <TouchableOpacity style={[styles.presetChip, { backgroundColor: mineOnly ? colors.primary + "18" : colors.card, borderColor: colors.border }]} onPress={() => setMineOnly((v) => !v)}>
            <Text style={[styles.presetChipText, { color: colors.text }]}>{mineOnly ? "My cases ✓" : "My cases"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.presetChip, { backgroundColor: todayOnly ? colors.primary + "18" : colors.card, borderColor: colors.border }]} onPress={() => setTodayOnly((v) => !v)}>
            <Text style={[styles.presetChipText, { color: colors.text }]}>{todayOnly ? "Today ✓" : "Today"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.presetChip, { backgroundColor: severityFilter === "fatal" ? colors.fatalLight : colors.card, borderColor: colors.border }]} onPress={() => setSeverityFilter((v) => (v === "fatal" ? "all" : "fatal"))}>
            <Text style={[styles.presetChipText, { color: colors.text }]}>Fatal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.presetChip, { backgroundColor: statusFilter === "open" ? colors.primary + "18" : colors.card, borderColor: colors.border }]} onPress={() => setStatusFilter((v) => (v === "open" ? "all" : "open"))}>
            <Text style={[styles.presetChipText, { color: colors.text }]}>Open</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }, filtered.length === 0 && styles.emptyList]}
        renderItem={({ item }) => <IncidentCard incident={item} />}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={<View style={styles.emptyState}><Feather name="map-pin" size={40} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.text }]}>No cases found</Text></View>}
      />
      <LocationFilterSheet
        visible={locationModalVisible}
        selectedStates={selectedStates}
        selectedLGAs={selectedLGAs}
        onApply={(states, lgas) => {
          setSelectedStates(states);
          setSelectedLGAs(lgas);
        }}
        onClose={() => setLocationModalVisible(false)}
      />
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary, bottom: insets.bottom + 92 }]}
        onPress={() => router.push("/report")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerText: { marginBottom: 8, paddingRight: 12 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSubtitle: { marginTop: 6, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  headerActionRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  headerActionsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
  },
  headerBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  filterSummaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterSummaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  locationSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  locationSummaryText: { flex: 1, minWidth: 0, fontSize: 12, fontFamily: "Inter_500Medium" },
  locationClearText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  filterMeta: { fontSize: 12, fontFamily: "Inter_500Medium" },
  presetRow: { paddingHorizontal: 0, paddingTop: 2, paddingBottom: 2, gap: 8 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 36,
    marginRight: 8,
  },
  presetChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16 },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontFamily: "Inter_700Bold" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  // LocationFilterSheet styles
  clearBtn: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  gpsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  gpsMsg: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  gpsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gpsBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badgesRow: { marginBottom: 10, flexGrow: 0 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  pickerText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quickRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  quickLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerHint: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  applyBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  applyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
