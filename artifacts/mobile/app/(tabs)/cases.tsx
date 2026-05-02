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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIncidents, IncidentStatus, SeverityLevel } from "@/context/IncidentContext";
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

  // Keep draft in sync when sheet reopens
  const prevVisible = useRef(false);
  if (visible && !prevVisible.current) {
    prevVisible.current = true;
    // reset drafts to parent values on open
  }
  if (!visible && prevVisible.current) {
    prevVisible.current = false;
  }

  // Reset drafts when modal becomes visible
  const onShow = useCallback(() => {
    setDraftStates(selectedStates);
    setDraftLGAs(selectedLGAs);
    setStateSearch("");
    setLGASearch("");
    setLocMsg("");
  }, [selectedStates, selectedLGAs]);

  // Available LGAs for selected states
  const availableLGAs = useMemo(() => getLGAsForStates(draftStates), [draftStates]);

  // When states change, remove LGAs that no longer belong
  const toggleState = (s: string) => {
    setDraftStates((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      // Remove any selected LGAs that don't belong to next states
      const validLGAs = getLGAsForStates(next);
      setDraftLGAs((prev2) => prev2.filter((l) => validLGAs.includes(l)));
      return next;
    });
  };

  const toggleLGA = (l: string) => {
    setDraftLGAs((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  };

  const filteredStates = useMemo(
    () =>
      ALL_STATE_NAMES.filter((s) =>
        s.toLowerCase().includes(stateSearch.toLowerCase())
      ),
    [stateSearch]
  );

  const filteredLGAs = useMemo(
    () =>
      availableLGAs.filter((l) =>
        l.toLowerCase().includes(lgaSearch.toLowerCase())
      ),
    [availableLGAs, lgaSearch]
  );

  // GPS-based location detection
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
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo?.region) {
        const detectedState = ALL_STATE_NAMES.find(
          (s) =>
            s.toLowerCase() === geo.region?.toLowerCase() ||
            geo.region?.toLowerCase().includes(s.toLowerCase()) ||
            s.toLowerCase().includes(geo.region?.toLowerCase() ?? "")
        );
        if (detectedState) {
          if (!draftStates.includes(detectedState)) {
            setDraftStates((prev) => [...prev, detectedState]);
          }
          if (geo.subregion || geo.city) {
            const locality = (geo.subregion || geo.city || "").trim();
            const matchLGA = getLGAsForStates([detectedState]).find(
              (l) =>
                l.toLowerCase().includes(locality.toLowerCase()) ||
                locality.toLowerCase().includes(l.toLowerCase())
            );
            if (matchLGA && !draftLGAs.includes(matchLGA)) {
              setDraftLGAs((prev) => [...prev, matchLGA]);
            }
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={onShow}
      onRequestClose={onClose}
    >
      <View style={[sheetStyles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
        {/* Header */}
        <View style={[sheetStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[sheetStyles.headerTitle, { color: colors.text }]}>Location Filter</Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={[sheetStyles.clearBtn, { color: colors.primary }]}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {/* GPS button */}
        <View style={[sheetStyles.gpsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="navigation" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[sheetStyles.gpsTitle, { color: colors.text }]}>Use My Location</Text>
            {locMsg ? (
              <Text style={[sheetStyles.gpsMsg, { color: colors.mutedForeground }]}>{locMsg}</Text>
            ) : (
              <Text style={[sheetStyles.gpsMsg, { color: colors.mutedForeground }]}>
                Auto-detect your state &amp; LGA from GPS
              </Text>
            )}
          </View>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <TouchableOpacity
              style={[sheetStyles.gpsBtn, { backgroundColor: colors.primary }]}
              onPress={handleNearMe}
            >
              <Text style={sheetStyles.gpsBtnText}>Detect</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* ── State Section ─────────────────────────── */}
          <View style={sheetStyles.section}>
            <View style={sheetStyles.sectionHeader}>
              <Feather name="map" size={14} color={colors.primary} />
              <Text style={[sheetStyles.sectionTitle, { color: colors.text }]}>
                State{draftStates.length > 0 ? ` (${draftStates.length} selected)` : ""}
              </Text>
            </View>

            {/* Selected state badges */}
            {draftStates.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheetStyles.badgesRow}>
                {draftStates.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[sheetStyles.badge, { backgroundColor: colors.primary }]}
                    onPress={() => toggleState(s)}
                  >
                    <Text style={sheetStyles.badgeText}>{s}</Text>
                    <Feather name="x" size={11} color="#fff" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* State search */}
            <View style={[sheetStyles.searchBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[sheetStyles.searchInput, { color: colors.text }]}
                placeholder="Search state…"
                placeholderTextColor={colors.mutedForeground}
                value={stateSearch}
                onChangeText={setStateSearch}
              />
              {stateSearch ? (
                <TouchableOpacity onPress={() => setStateSearch("")}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* State grid */}
            <View style={sheetStyles.chipGrid}>
              {filteredStates.map((s) => {
                const active = draftStates.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      sheetStyles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => toggleState(s)}
                  >
                    {active && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                    <Text style={[sheetStyles.chipText, { color: active ? "#fff" : colors.text }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── LGA Section ───────────────────────────── */}
          {draftStates.length > 0 && (
            <View style={sheetStyles.section}>
              <View style={sheetStyles.sectionHeader}>
                <Feather name="map-pin" size={14} color={colors.secondary} />
                <Text style={[sheetStyles.sectionTitle, { color: colors.text }]}>
                  Local Government{draftLGAs.length > 0 ? ` (${draftLGAs.length} selected)` : ""}
                </Text>
              </View>
              <Text style={[sheetStyles.sectionHint, { color: colors.mutedForeground }]}>
                Showing LGAs from: {draftStates.join(", ")}
              </Text>

              {/* Selected LGA badges */}
              {draftLGAs.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheetStyles.badgesRow}>
                  {draftLGAs.map((l) => (
                    <TouchableOpacity
                      key={l}
                      style={[sheetStyles.badge, { backgroundColor: colors.secondary }]}
                      onPress={() => toggleLGA(l)}
                    >
                      <Text style={sheetStyles.badgeText}>{l}</Text>
                      <Feather name="x" size={11} color="#fff" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* LGA quick-select shortcuts if states chosen */}
              {draftStates.length === 1 && draftLGAs.length === 0 && (
                <View style={sheetStyles.quickRow}>
                  <Text style={[sheetStyles.quickLabel, { color: colors.mutedForeground }]}>Quick pick:</Text>
                  {(NIGERIA_STATE_LGAS.find((s) => s.name === draftStates[0])?.lgas.slice(0, 5) ?? []).map((l) => (
                    <TouchableOpacity
                      key={l}
                      style={[sheetStyles.quickChip, { borderColor: colors.secondary }]}
                      onPress={() => toggleLGA(l)}
                    >
                      <Text style={[sheetStyles.quickChipText, { color: colors.secondary }]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* LGA search */}
              <View style={[sheetStyles.searchBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[sheetStyles.searchInput, { color: colors.text }]}
                  placeholder="Search LGA…"
                  placeholderTextColor={colors.mutedForeground}
                  value={lgaSearch}
                  onChangeText={setLGASearch}
                />
                {lgaSearch ? (
                  <TouchableOpacity onPress={() => setLGASearch("")}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* LGA grid */}
              <View style={sheetStyles.chipGrid}>
                {filteredLGAs.map((l) => {
                  const active = draftLGAs.includes(l);
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[
                        sheetStyles.chip,
                        {
                          backgroundColor: active ? colors.secondary : colors.muted,
                          borderColor: active ? colors.secondary : colors.border,
                        },
                      ]}
                      onPress={() => toggleLGA(l)}
                    >
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

        {/* Apply footer */}
        <View style={[sheetStyles.footer, { borderTopColor: colors.border }]}>
          {totalSelected > 0 && (
            <Text style={[sheetStyles.footerHint, { color: colors.mutedForeground }]}>
              {draftStates.length > 0 ? `${draftStates.length} state${draftStates.length > 1 ? "s" : ""}` : ""}
              {draftStates.length > 0 && draftLGAs.length > 0 ? " · " : ""}
              {draftLGAs.length > 0 ? `${draftLGAs.length} LGA${draftLGAs.length > 1 ? "s" : ""}` : ""}
              {" selected"}
            </Text>
          )}
          <TouchableOpacity
            style={[sheetStyles.applyBtn, { backgroundColor: colors.primary }]}
            onPress={apply}
          >
            <Text style={sheetStyles.applyBtnText}>Apply Filter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  clearBtn: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  gpsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  gpsMsg: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  gpsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  gpsBtnText: { fontSize: 12, color: "#fff", fontFamily: "Inter_700Bold" },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badgesRow: { marginBottom: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 6,
  },
  badgeText: { fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quickRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  quickLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  footerHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  applyBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ---------------------------------------------------------------------------
// Main Cases screen
// ---------------------------------------------------------------------------
export default function CasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incidents } = useIncidents();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ severity?: string; status?: string; filter?: string }>();

  // Resolve initial filter from navigation params (deep-link from home/analytics cards)
  const initSeverity = ((): SeverityLevel | "all" => {
    const s = params.severity;
    if (s === "fatal" || s === "serious" || s === "minor" || s === "property_only") return s;
    return "all";
  })();
  const initStatus = ((): StatusFilterValue => {
    const s = params.status;
    if (s === "submitted" || s === "assigned" || s === "under_review" || s === "closed") return s;
    if (s === "open") return "open";
    return "all";
  })();
  const initTodayOnly = params.filter === "today";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(initStatus);
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | "all">(initSeverity);
  const [todayOnly, setTodayOnly] = useState(initTodayOnly);
  const [mineOnly, setMineOnly] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedLGAs, setSelectedLGAs] = useState<string[]>([]);

  const locationActive = selectedStates.length > 0 || selectedLGAs.length > 0;
  const locationBadge = selectedStates.length + selectedLGAs.length;

  const filtered = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return incidents.filter((inc) => {
      const matchSearch =
        !search ||
        inc.title.toLowerCase().includes(search.toLowerCase()) ||
        inc.id.toLowerCase().includes(search.toLowerCase()) ||
        inc.location.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "open" ? inc.status !== "closed" :
        inc.status === statusFilter;

      const matchSeverity = severityFilter === "all" || inc.severity === severityFilter;
      const matchMine = !mineOnly || inc.reportedBy === user?.id;
      const matchToday = !todayOnly || new Date(inc.dateTime) >= todayStart;

      let matchLocation = true;
      if (selectedStates.length > 0) {
        matchLocation = selectedStates.includes(inc.state ?? "");
      }
      if (matchLocation && selectedLGAs.length > 0) {
        matchLocation = selectedLGAs.includes(inc.lga ?? "");
      }

      return matchSearch && matchStatus && matchSeverity && matchMine && matchToday && matchLocation;
    });
  }, [incidents, search, statusFilter, severityFilter, mineOnly, todayOnly, user?.id, selectedStates, selectedLGAs]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Cases</Text>
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/report")}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchRow,
            { borderColor: colors.border, backgroundColor: colors.muted },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by ID, location, title…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter row: status + Mine toggle */}
        <View style={styles.filterBarRow}>
          <FlatList
            horizontal
            data={STATUS_FILTERS}
            keyExtractor={(i) => i.value}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
            style={{ flexShrink: 1 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      statusFilter === item.value ? colors.primary : colors.muted,
                    borderColor:
                      statusFilter === item.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setStatusFilter(item.value)}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    {
                      color:
                        statusFilter === item.value
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
          {/* Mine toggle */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              styles.filterChipSmall,
              styles.filterChipRow,
              {
                backgroundColor: mineOnly ? colors.secondary : colors.muted,
                borderColor: mineOnly ? colors.secondary : colors.border,
                marginLeft: 6,
              },
            ]}
            onPress={() => setMineOnly((v) => !v)}
          >
            <Feather name="user" size={11} color={mineOnly ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.filterLabel, { color: mineOnly ? "#fff" : colors.mutedForeground }]}>
              Mine
            </Text>
          </TouchableOpacity>
        </View>

        {/* Severity + Location row */}
        <View style={styles.filterBarRow}>
          <FlatList
            horizontal
            data={SEVERITY_FILTERS}
            keyExtractor={(i) => i.value}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
            style={{ flexShrink: 1 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  styles.filterChipSmall,
                  {
                    backgroundColor:
                      severityFilter === item.value ? colors.secondary : colors.muted,
                    borderColor:
                      severityFilter === item.value ? colors.secondary : colors.border,
                  },
                ]}
                onPress={() => setSeverityFilter(item.value)}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    {
                      color:
                        severityFilter === item.value
                          ? "#fff"
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Location filter button */}
          <TouchableOpacity
            style={[
              styles.locationBtn,
              {
                backgroundColor: locationActive ? colors.primary : colors.muted,
                borderColor: locationActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setLocationModalVisible(true)}
          >
            <Feather
              name="map-pin"
              size={13}
              color={locationActive ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.filterLabel,
                { color: locationActive ? "#fff" : colors.mutedForeground },
              ]}
            >
              Location
            </Text>
            {locationBadge > 0 && (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeDotText}>{locationBadge}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Today-only active chip */}
        {todayOnly && (
          <View style={[styles.activeLocRow, { backgroundColor: colors.infoLight }]}>
            <Feather name="calendar" size={12} color={colors.info} />
            <Text style={[styles.activeLocText, { color: colors.info }]}>Today's incidents only</Text>
            <TouchableOpacity onPress={() => setTodayOnly(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={13} color={colors.info} />
            </TouchableOpacity>
          </View>
        )}

        {/* Active location summary strip */}
        {locationActive && (
          <View style={[styles.activeLocRow, { backgroundColor: colors.muted }]}>
            <Feather name="map-pin" size={12} color={colors.primary} />
            <Text style={[styles.activeLocText, { color: colors.text }]} numberOfLines={1}>
              {selectedStates.length > 0
                ? selectedStates.join(", ")
                : ""}
              {selectedLGAs.length > 0
                ? ` › ${selectedLGAs.join(", ")}`
                : ""}
            </Text>
            <TouchableOpacity
              onPress={() => { setSelectedStates([]); setSelectedLGAs([]); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Count */}
      <View style={[styles.countRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {filtered.length} {filtered.length === 1 ? "case" : "cases"}
          {mineOnly ? " reported by me" : ""}
          {locationActive ? " in selected area" : ""}
        </Text>
        {mineOnly && (
          <TouchableOpacity onPress={() => setMineOnly(false)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Feather name="x-circle" size={14} color={colors.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          filtered.length === 0 && styles.emptyList,
        ]}
        renderItem={({ item }) => <IncidentCard incident={item} />}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No cases found
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {locationActive
                ? "No incidents in the selected states/LGAs"
                : "Try adjusting your search or filters"}
            </Text>
            {locationActive && (
              <TouchableOpacity
                style={[styles.clearLocBtn, { borderColor: colors.primary }]}
                onPress={() => { setSelectedStates([]); setSelectedLGAs([]); }}
              >
                <Text style={[styles.clearLocBtnText, { color: colors.primary }]}>
                  Clear location filter
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingTop: 2,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipSmall: { paddingVertical: 4, paddingHorizontal: 12 },
  filterChipRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  filterLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 16,
  },
  badgeDot: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    marginLeft: 2,
  },
  badgeDotText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  activeLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeLocText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  countRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  countText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  emptyList: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  clearLocBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearLocBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
