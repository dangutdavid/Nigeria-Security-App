import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
  const [stateSearch, setStateSearch] = useState("");
  const [lgaSearch, setLGASearch] = useState("");
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState("");

  const onShow = useCallback(() => {
    setDraftStates(selectedStates);
    setDraftLGAs(selectedLGAs);
    setStateSearch("");
    setLGASearch("");
    setLocMsg("");
  }, [selectedStates, selectedLGAs]);

  const availableLGAs = useMemo(() => getLGAsForStates(draftStates), [draftStates]);

  const toggleState = (s: string) => {
    setDraftStates((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      const validLGAs = getLGAsForStates(next);
      setDraftLGAs((prev2) => prev2.filter((l) => validLGAs.includes(l)));
      return next;
    });
  };

  const toggleLGA = (l: string) => {
    setDraftLGAs((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  };

  const filteredStates = useMemo(() => ALL_STATE_NAMES.filter((s) => s.toLowerCase().includes(stateSearch.toLowerCase())), [stateSearch]);
  const filteredLGAs = useMemo(() => availableLGAs.filter((l) => l.toLowerCase().includes(lgaSearch.toLowerCase())), [availableLGAs, lgaSearch]);

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
    setStateSearch("");
    setLGASearch("");
    setLocMsg("");
  };

  const apply = () => {
    onApply(draftStates, draftLGAs);
    onClose();
  };

  const totalSelected = draftStates.length + draftLGAs.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={onShow} onRequestClose={onClose}>
      <View style={[sheetStyles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
        <View style={[sheetStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[sheetStyles.headerTitle, { color: colors.text }]}>Location Filter</Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={[sheetStyles.clearBtn, { color: colors.primary }]}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <View style={[sheetStyles.gpsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="navigation" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[sheetStyles.gpsTitle, { color: colors.text }]}>Use My Location</Text>
            {locMsg ? <Text style={[sheetStyles.gpsMsg, { color: colors.mutedForeground }]}>{locMsg}</Text> : <Text style={[sheetStyles.gpsMsg, { color: colors.mutedForeground }]}>Auto-detect your state &amp; LGA from GPS</Text>}
          </View>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <TouchableOpacity style={[sheetStyles.gpsBtn, { backgroundColor: colors.primary }]} onPress={handleNearMe}>
              <Text style={sheetStyles.gpsBtnText}>Detect</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={sheetStyles.section}>
            <View style={sheetStyles.sectionHeader}>
              <Feather name="map" size={14} color={colors.primary} />
              <Text style={[sheetStyles.sectionTitle, { color: colors.text }]}>State{draftStates.length > 0 ? ` (${draftStates.length} selected)` : ""}</Text>
            </View>

            {draftStates.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheetStyles.badgesRow}>
                {draftStates.map((s) => (
                  <TouchableOpacity key={`state-${s}`} style={[sheetStyles.badge, { backgroundColor: colors.primary }]} onPress={() => toggleState(s)}>
                    <Text style={sheetStyles.badgeText}>{s}</Text>
                    <Feather name="x" size={11} color="#fff" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={[sheetStyles.searchBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput style={[sheetStyles.searchInput, { color: colors.text }]} placeholder="Search state…" placeholderTextColor={colors.mutedForeground} value={stateSearch} onChangeText={setStateSearch} />
              {stateSearch ? <TouchableOpacity onPress={() => setStateSearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
            </View>

            <View style={sheetStyles.chipGrid}>
              {filteredStates.map((s) => {
                const active = draftStates.includes(s);
                return (
                  <TouchableOpacity key={s} style={[sheetStyles.chip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]} onPress={() => toggleState(s)}>
                    {active && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                    <Text style={[sheetStyles.chipText, { color: active ? "#fff" : colors.text }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {draftStates.length > 0 && (
            <View style={sheetStyles.section}>
              <View style={sheetStyles.sectionHeader}>
                <Feather name="map-pin" size={14} color={colors.secondary} />
                <Text style={[sheetStyles.sectionTitle, { color: colors.text }]}>Local Government{draftLGAs.length > 0 ? ` (${draftLGAs.length} selected)` : ""}</Text>
              </View>
              <Text style={[sheetStyles.sectionHint, { color: colors.mutedForeground }]}>Showing LGAs from: {draftStates.join(", ")}</Text>

              {draftLGAs.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheetStyles.badgesRow}>
                  {draftLGAs.map((l) => (
                    <TouchableOpacity key={`lga-${l}`} style={[sheetStyles.badge, { backgroundColor: colors.secondary }]} onPress={() => toggleLGA(l)}>
                      <Text style={sheetStyles.badgeText}>{l}</Text>
                      <Feather name="x" size={11} color="#fff" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {draftStates.length === 1 && draftLGAs.length === 0 && (
                <View style={sheetStyles.quickRow}>
                  <Text style={[sheetStyles.quickLabel, { color: colors.mutedForeground }]}>Quick pick:</Text>
                  {(NIGERIA_STATE_LGAS.find((s) => s.name === draftStates[0])?.lgas.slice(0, 5) ?? []).map((l) => (
                    <TouchableOpacity key={`quick-${draftStates[0]}-${l}`} style={[sheetStyles.quickChip, { borderColor: colors.secondary }]} onPress={() => toggleLGA(l)}>
                      <Text style={[sheetStyles.quickChipText, { color: colors.secondary }]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[sheetStyles.searchBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput style={[sheetStyles.searchInput, { color: colors.text }]} placeholder="Search LGA…" placeholderTextColor={colors.mutedForeground} value={lgaSearch} onChangeText={setLGASearch} />
                {lgaSearch ? <TouchableOpacity onPress={() => setLGASearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
              </View>

              <View style={sheetStyles.chipGrid}>
                {filteredLGAs.map((l) => {
                  const active = draftLGAs.includes(l);
                  return (
                    <TouchableOpacity key={l} style={[sheetStyles.chip, { backgroundColor: active ? colors.secondary : colors.muted, borderColor: active ? colors.secondary : colors.border }]} onPress={() => toggleLGA(l)}>
                      {active && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                      <Text style={[sheetStyles.chipText, { color: active ? "#fff" : colors.text }]}>{l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={[sheetStyles.footer, { borderTopColor: colors.border }]}>
          {totalSelected > 0 && <Text style={[sheetStyles.footerHint, { color: colors.mutedForeground }]}>{draftStates.length > 0 ? `${draftStates.length} state${draftStates.length > 1 ? "s" : ""}` : ""}{draftStates.length > 0 && draftLGAs.length > 0 ? " · " : ""}{draftLGAs.length > 0 ? `${draftLGAs.length} LGA${draftLGAs.length > 1 ? "s" : ""}` : ""}{" selected"}</Text>}
          <TouchableOpacity style={[sheetStyles.applyBtn, { backgroundColor: colors.primary }]} onPress={apply}>
            <Text style={sheetStyles.applyBtnText}>Apply</Text>
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
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerText: { marginBottom: 2 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSubtitle: { marginTop: 4, fontSize: 12, fontFamily: "Inter_400Regular" },
  headerActionRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
    borderBottomWidth: 1,
  },
  headerActionsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
});
