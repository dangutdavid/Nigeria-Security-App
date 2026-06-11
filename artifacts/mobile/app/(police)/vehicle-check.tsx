import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCrimeReports, CRIME_TYPE_LABELS, CrimeType } from "@/context/CrimeReportContext";
import { useTheftReports } from "@/context/TheftReportContext";
import { useColors } from "@/hooks/useColors";
import { PlateFlagBanner } from "@/components/PlateFlagBanner";
import { normalizePlate } from "@/lib/plate";

const PRIMARY = "#1A3A6C";

const STATUS_COLORS: Record<string, string> = {
  open: "#E53935",
  investigating: "#F57C00",
  arrested: "#388E3C",
  closed: "#9E9E9E",
  active: "#E53935",
  recovered: "#388E3C",
  false_alarm: "#9E9E9E",
};

interface CheckResult {
  crime: any[];
  theft: any[];
}

export default function VehicleCheckScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { reports } = useCrimeReports();
  const { reports: theftReports } = useTheftReports();
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleCheck() {
    if (!plate.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const q = normalizePlate(plate);

    const crimeMatches = reports.filter((r) => r.plate && normalizePlate(r.plate) === q);
    const theftMatches = theftReports.filter(
      (r: { plate: string; status: string }) => normalizePlate(r.plate) === q && r.status === "active",
    );

    setResult({ crime: crimeMatches, theft: theftMatches });
    setSearched(true);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY }]}>
        <Text style={styles.headerTitle}>Vehicle Crime Check</Text>
        <Text style={styles.headerSub}>Check any plate number against crime & theft databases</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.searchLabel, { color: colors.text }]}>Enter Vehicle Plate</Text>
          <View style={styles.searchRow}>
            <View style={[styles.plateInput, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
              <Text style={styles.platePrefixText}>NG</Text>
              <View style={styles.plateDivider} />
              <TextInput
                value={plate}
                onChangeText={(t) => { setPlate(t); setSearched(false); setResult(null); }}
                placeholder="ABJ 234 KA"
                placeholderTextColor="#B8860B"
                style={styles.plateTextInput}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleCheck}
              />
            </View>
            <TouchableOpacity
              style={[styles.checkBtn, { backgroundColor: PRIMARY }]}
              onPress={handleCheck}
              activeOpacity={0.85}
            >
              <Feather name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>
            Checks against NPF crime records & stolen vehicle reports
          </Text>
        </View>

        {/* Result */}
        {searched && result && (
          <View style={{ gap: 12 }}>
            {result.crime.length === 0 && result.theft.length === 0 && (
              <View style={[styles.resultCard, { backgroundColor: "#E8F5E9", borderColor: "#C8E6C9" }]}>
                <View style={[styles.resultIcon, { backgroundColor: "#388E3C22" }]}>
                  <Feather name="check-circle" size={28} color="#388E3C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clearTitle}>No Records Found</Text>
                  <Text style={styles.clearSub}>
                    Vehicle plate <Text style={{ fontFamily: "Inter_700Bold" }}>{plate.trim().toUpperCase()}</Text> has no matches in crime or stolen vehicle databases.
                  </Text>
                </View>
              </View>
            )}

            {result.crime.length > 0 && (
              <>
                <View style={[styles.alertBanner, { backgroundColor: "#FFEBEE", borderColor: "#FFCDD2" }]}>
                  <Feather name="alert-octagon" size={22} color="#C62828" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>⚠ CRIME RECORD FOUND</Text>
                    <Text style={styles.alertSub}>This vehicle is linked to {result.crime.length} crime report{result.crime.length !== 1 ? "s" : ""} in NPF database</Text>
                  </View>
                </View>
                {result.crime.map((r: any) => (
                  <View key={r.id} style={[styles.matchCard, { backgroundColor: colors.card, borderColor: "#E53935" + "44" }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={[styles.matchTitle, { color: colors.text }]} numberOfLines={2}>{r.title}</Text>
                      <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[r.status] + "22" }]}>
                        <Text style={[styles.statusChipText, { color: STATUS_COLORS[r.status] }]}>{r.status}</Text>
                      </View>
                    </View>
                    <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>{CRIME_TYPE_LABELS[r.crimeType as CrimeType]} · {r.location}</Text>
                    <Text style={[styles.matchCase, { color: PRIMARY }]}>{r.caseNumber} · {timeAgo(r.reportedAt)}</Text>
                  </View>
                ))}
              </>
            )}

            {result.theft.length > 0 && (
              <>
                <View style={[styles.alertBanner, { backgroundColor: "#FFF3E0", borderColor: "#FFE0B2" }]}>
                  <Feather name="alert-triangle" size={22} color="#E65100" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: "#E65100" }]}>⚠ STOLEN VEHICLE ALERT</Text>
                    <Text style={[styles.alertSub, { color: "#BF360C" }]}>This vehicle is currently reported stolen</Text>
                  </View>
                </View>
                {result.theft.map((r: any) => (
                  <View key={r.id} style={[styles.matchCard, { backgroundColor: colors.card, borderColor: "#E65100" + "44" }]}>
                    <Text style={[styles.matchTitle, { color: colors.text }]}>{r.color} {r.make} {r.model} ({r.year})</Text>
                    <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>
                      Reported stolen: {r.location} · {timeAgo(r.reportedAt)}
                    </Text>
                    {r.reporterName && (
                      <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>Reporter: {r.reporterName} · {r.reporterPhone}</Text>
                    )}
                    <Text style={[styles.matchMeta, { color: "#E65100" }]} numberOfLines={2}>{r.description}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Open cross-agency referrals for this plate */}
            <PlateFlagBanner plate={plate} kinds={["referral"]} />
          </View>
        )}

        {/* Recent Checks History Label */}
        {!searched && (
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={18} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Enter any Nigerian vehicle plate number to instantly check against the NPF crime database and national stolen vehicle registry.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 4 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  content: { padding: 16, gap: 14 },
  searchCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 14 },
  searchLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  searchRow: { flexDirection: "row", gap: 10 },
  plateInput: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 12, overflow: "hidden" },
  platePrefixText: { paddingHorizontal: 12, fontSize: 16, fontFamily: "Inter_700Bold", color: "#8B6914" },
  plateDivider: { width: 1.5, height: "70%", backgroundColor: "#DAA520" },
  plateTextInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 2 },
  checkBtn: { width: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  resultCard: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  resultIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  clearTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1B5E20", marginBottom: 4 },
  clearSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#2E7D32" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  alertTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#C62828", marginBottom: 2 },
  alertSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#B71C1C" },
  matchCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 6 },
  matchTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  matchMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  matchCase: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  statusChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoBox: { flexDirection: "row", gap: 12, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
