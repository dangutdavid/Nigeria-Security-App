import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lookupVehicle, VehicleRecord, VehicleStatus } from "@/data/vehicleDb";
import { useColors } from "@/hooks/useColors";
import { usePatrol } from "@/context/PatrolContext";
import { useIncidents } from "@/context/IncidentContext";

const RECENT_KEY = "@frsc_recent_plates";

const STATUS_COLOR: Record<VehicleStatus, string> = {
  valid: "#27AE60",
  expired: "#E67E22",
  suspended: "#C0392B",
  stolen: "#8B0000",
};

const STATUS_BG: Record<VehicleStatus, string> = {
  valid: "#E8F8EE",
  expired: "#FEF3E2",
  suspended: "#FDEAEA",
  stolen: "#FDEAEA",
};

const CATEGORY_LABEL: Record<string, string> = {
  private: "Private",
  commercial: "Commercial",
  government: "Government",
  motorcycle: "Motorcycle",
};

const QUICK_PLATES = [
  "AGL 234 KJ",
  "KAN 812 AA",
  "FCT 399 RS",
  "LAG 501 MX",
  "OSU 773 PQ",
];

export default function VehicleLookupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeSession, addEncounter } = usePatrol();
  const { incidents } = useIncidents();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<VehicleRecord | null | "not_found">(null);
  const [loading, setLoading] = useState(false);
  const [logged, setLogged] = useState(false);
  const [recentPlates, setRecentPlates] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((val) => {
      if (val) {
        try { setRecentPlates(JSON.parse(val) as string[]); } catch { /* ignore */ }
      }
    });
  }, []);

  async function addToRecent(plate: string) {
    const cleaned = plate.trim().toUpperCase();
    const next = [cleaned, ...recentPlates.filter((p) => p !== cleaned)].slice(0, 6);
    setRecentPlates(next);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function handleSearch(plate?: string) {
    const searchPlate = plate ?? query;
    if (!searchPlate.trim()) return;
    setLoading(true);
    setLogged(false);
    void addToRecent(searchPlate);
    setTimeout(() => {
      const found = lookupVehicle(searchPlate.trim());
      setResult(found ?? "not_found");
      setLoading(false);
      if (found?.flags && found.flags.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 600);
  }

  async function clearRecent() {
    setRecentPlates([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }

  async function logToPatrol() {
    if (!activeSession || !result || result === "not_found") return;
    await addEncounter({
      type: "vehicle_check",
      description: `Vehicle check: ${result.plate} — ${result.make} ${result.model} (${result.color})`,
      plate: result.plate,
      location: "Current patrol location",
    });
    setLogged(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Logged", "Vehicle check added to your patrol log.");
  }

  const vehicle = result !== "not_found" ? result : null;

  const relatedIncidents = useMemo(() => {
    if (!vehicle) return [];
    const plate = vehicle.plate.toUpperCase();
    return incidents.filter((inc) =>
      inc.vehicles?.some((v) => v.plate?.toUpperCase().replace(/\s/g, "") === plate.replace(/\s/g, ""))
    );
  }, [vehicle, incidents]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Vehicle Lookup</Text>
            <View style={{ width: 22 }} />
          </View>
          <Text style={styles.headerSub}>
            FRSC Vehicle Registration Database{recentPlates.length > 0 ? ` · ${recentPlates.length} recent search${recentPlates.length !== 1 ? "es" : ""}` : ""}
          </Text>

          {/* Search bar */}
          <View style={[styles.searchBox, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Feather name="search" size={18} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter plate number e.g. AGL 234 KJ"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setResult(null); setLogged(false); }}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.secondary }]}
            onPress={() => handleSearch()}
            disabled={loading || !query.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.searchBtnText}>
              {loading ? "Searching…" : "Search Database"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick examples + recent */}
          {!result && !loading && (
            <View style={{ paddingHorizontal: 14 }}>
              {recentPlates.length > 0 && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RECENT SEARCHES</Text>
                    <TouchableOpacity onPress={clearRecent}>
                      <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.quickRow}>
                    {recentPlates.map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => { setQuery(p); handleSearch(p); }}
                        style={[styles.quickChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                      >
                        <Feather name="clock" size={12} color={colors.primary} />
                        <Text style={[styles.quickChipText, { color: colors.primary }]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                SAMPLE PLATES (TAP TO SEARCH)
              </Text>
              <View style={styles.quickRow}>
                {QUICK_PLATES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => { setQuery(p); handleSearch(p); }}
                    style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Feather name="hash" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.quickChipText, { color: colors.text }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.tipBox, { backgroundColor: colors.infoLight, borderColor: colors.info + "30" }]}>
                <Feather name="info" size={14} color={colors.info} />
                <Text style={[styles.tipText, { color: colors.info }]}>
                  In the field, enter the full plate number including state code. Try "FCT 399 RS" for a stolen vehicle alert.
                </Text>
              </View>
            </View>
          )}

          {/* Not found */}
          {result === "not_found" && (
            <View style={[styles.notFound, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
              <Text style={[styles.notFoundTitle, { color: colors.text }]}>No Record Found</Text>
              <Text style={[styles.notFoundSub, { color: colors.mutedForeground }]}>
                The plate number "{query}" was not found in the FRSC database. Treat as unregistered.
              </Text>
            </View>
          )}

          {/* Result */}
          {vehicle && (
            <View style={{ paddingHorizontal: 14, gap: 14 }}>
              {/* Flags */}
              {vehicle.flags.length > 0 && (
                <View style={[styles.flagsBox, { backgroundColor: "#FDEAEA", borderColor: "#C0392B30" }]}>
                  <View style={styles.flagsHeader}>
                    <Feather name="alert-triangle" size={16} color="#C0392B" />
                    <Text style={styles.flagsTitle}>ALERTS</Text>
                  </View>
                  {vehicle.flags.map((f, i) => (
                    <Text key={i} style={styles.flagText}>• {f}</Text>
                  ))}
                </View>
              )}

              {/* Plate + identity */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.plateHeader}>
                  <View style={[styles.plateBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.plateText}>{vehicle.plate}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vehicleName, { color: colors.text }]}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Text>
                    <Text style={[styles.vehicleSub, { color: colors.mutedForeground }]}>
                      {vehicle.color} · {CATEGORY_LABEL[vehicle.category]}
                    </Text>
                  </View>
                </View>
                <DetailRow label="Engine No." value={vehicle.engineNo} colors={colors} />
                <DetailRow label="Chassis No." value={vehicle.chassisNo} colors={colors} last />
              </View>

              {/* Owner */}
              <SectionCard title="OWNER DETAILS" icon="user" colors={colors}>
                <DetailRow label="Name" value={vehicle.owner.name} colors={colors} />
                <DetailRow label="Address" value={vehicle.owner.address} colors={colors} />
                <DetailRow label="Phone" value={vehicle.owner.phone} colors={colors} />
                <DetailRow label="License No." value={vehicle.owner.licenseNo} colors={colors} />
                <DetailRow
                  label="License Expiry"
                  value={vehicle.owner.licenseExpiry}
                  highlight={isExpired(vehicle.owner.licenseExpiry)}
                  colors={colors}
                  last
                />
              </SectionCard>

              {/* Registration */}
              <SectionCard title="REGISTRATION" icon="file-text" colors={colors}>
                <StatusDetailRow
                  label="Status"
                  status={vehicle.registration.status}
                  colors={colors}
                />
                <DetailRow label="State" value={vehicle.registration.state} colors={colors} />
                <DetailRow label="LGA" value={vehicle.registration.lga} colors={colors} />
                <DetailRow
                  label="Expiry"
                  value={vehicle.registration.expiry}
                  highlight={vehicle.registration.status !== "valid"}
                  colors={colors}
                  last
                />
              </SectionCard>

              {/* Insurance */}
              <SectionCard title="INSURANCE" icon="shield" colors={colors}>
                <StatusDetailRow
                  label="Status"
                  status={vehicle.insurance.status}
                  colors={colors}
                />
                <DetailRow label="Company" value={vehicle.insurance.company} colors={colors} />
                <DetailRow label="Policy No." value={vehicle.insurance.policyNo} colors={colors} />
                <DetailRow
                  label="Expiry"
                  value={vehicle.insurance.expiry}
                  highlight={vehicle.insurance.status !== "valid"}
                  colors={colors}
                  last
                />
              </SectionCard>

              {/* Roadworthiness */}
              <SectionCard title="ROADWORTHINESS" icon="check-circle" colors={colors}>
                <StatusDetailRow
                  label="Status"
                  status={vehicle.roadworthiness.status}
                  colors={colors}
                />
                <DetailRow label="Last Inspected" value={vehicle.roadworthiness.lastInspected} colors={colors} />
                <DetailRow label="Station" value={vehicle.roadworthiness.station} colors={colors} />
                <DetailRow
                  label="Expiry"
                  value={vehicle.roadworthiness.expiry}
                  highlight={vehicle.roadworthiness.status !== "valid"}
                  colors={colors}
                  last
                />
              </SectionCard>

              {/* Related incidents */}
              {relatedIncidents.length > 0 && (
                <View style={[styles.relatedCard, { backgroundColor: colors.warningLight, borderColor: colors.warning + "40" }]}>
                  <View style={styles.relatedHeader}>
                    <Feather name="alert-triangle" size={14} color={colors.warning} />
                    <Text style={[styles.relatedTitle, { color: colors.warning }]}>
                      {relatedIncidents.length} incident{relatedIncidents.length > 1 ? "s" : ""} on record for this plate
                    </Text>
                  </View>
                  {relatedIncidents.slice(0, 3).map((inc) => (
                    <TouchableOpacity
                      key={inc.id}
                      style={[styles.relatedRow, { borderTopColor: colors.warning + "30" }]}
                      onPress={() => router.push(`/case/${inc.id}` as any)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.relatedRowTitle, { color: colors.text }]} numberOfLines={1}>{inc.title}</Text>
                        <Text style={[styles.relatedRowMeta, { color: colors.mutedForeground }]}>
                          {inc.severity.toUpperCase()} · {new Date(inc.dateTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Log to patrol */}
              {activeSession && (
                <TouchableOpacity
                  onPress={logToPatrol}
                  disabled={logged}
                  style={[
                    styles.logBtn,
                    {
                      backgroundColor: logged ? colors.muted : colors.primary,
                      borderColor: logged ? colors.border : colors.primary,
                    },
                  ]}
                >
                  <Feather
                    name={logged ? "check" : "clipboard"}
                    size={16}
                    color={logged ? colors.mutedForeground : "#fff"}
                  />
                  <Text style={[styles.logBtnText, { color: logged ? colors.mutedForeground : "#fff" }]}>
                    {logged ? "Logged to Patrol" : "Log to Patrol Log"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function isExpired(dateStr: string): boolean {
  if (!dateStr || dateStr === "N/A") return false;
  return new Date(dateStr) < new Date();
}

function SectionCard({
  title,
  icon,
  children,
  colors,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Feather name={icon as any} size={12} color={colors.mutedForeground} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0, marginLeft: 4 }]}>
          {title}
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  last,
  colors,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : 1 },
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          { color: highlight ? "#C0392B" : colors.text },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function StatusDetailRow({
  label,
  status,
  colors,
}: {
  label: string;
  status: VehicleStatus;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        { borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[status] }]}>
        <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[status] }]}>
          {status.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    padding: 0,
  },
  searchBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  tipBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  notFound: {
    margin: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  notFoundTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  notFoundSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  flagsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  flagsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  flagsTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#C0392B",
    letterSpacing: 0.6,
  },
  flagText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#C0392B",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  plateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE2E7",
  },
  plateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  plateText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  vehicleName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  vehicleSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 2,
    textAlign: "right",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  clearText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  relatedCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  relatedHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  relatedTitle: { fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },
  relatedRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, marginTop: 6, borderTopWidth: 1, gap: 8 },
  relatedRowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  relatedRowMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
