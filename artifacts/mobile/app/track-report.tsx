import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  formatMinutesAgo,
  TheftReport,
  TheftStatusAction,
  useTheftReports,
} from "@/context/TheftReportContext";

const ACTION_LABEL: Record<TheftStatusAction, string> = {
  reported: "Report submitted",
  acknowledged: "Acknowledged by Police",
  investigating: "Investigation started",
  recovered: "Vehicle marked recovered",
  false_alarm: "Closed as false alarm",
};

function currentState(r: TheftReport): {
  label: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
  sub: string;
} {
  if (r.status === "recovered")
    return {
      label: "Vehicle Recovered",
      color: "#1B7F4B",
      icon: "check-circle",
      sub: "Good news — this vehicle has been marked as recovered.",
    };
  if (r.status === "false_alarm")
    return {
      label: "Closed — False Alarm",
      color: "#9E9E9E",
      icon: "x-circle",
      sub: "This report was closed as a false alarm.",
    };
  switch (r.stage) {
    case "investigating":
      return {
        label: "Under Investigation",
        color: "#1A3A6C",
        icon: "search",
        sub: "An officer is actively investigating this report.",
      };
    case "acknowledged":
      return {
        label: "Acknowledged by Police",
        color: "#E67E22",
        icon: "eye",
        sub: "Police have received and acknowledged your report.",
      };
    default:
      return {
        label: "Report Received",
        color: "#C8960C",
        icon: "clock",
        sub: "Your report has been logged and is awaiting officer review.",
      };
  }
}

export default function TrackReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { getReportByReference, reports } = useTheftReports();

  const [query, setQuery] = useState(params.ref ?? "");
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<TheftReport | null>(null);

  function runSearch(ref: string) {
    const found = getReportByReference(ref);
    setResult(found);
    setSearched(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  useEffect(() => {
    if (!params.ref) return;
    setQuery(params.ref);
    // Wait for the provider to hydrate from storage before searching, otherwise a
    // cold deep-link (/track-report?ref=...) would search an empty list and get
    // stuck on "No report found". reports always seeds to a non-empty list once loaded.
    if (reports.length === 0) return;
    runSearch(params.ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ref, reports]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: "#0A1628", paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Track Your Report</Text>
            <Text style={styles.headerSub}>Enter your case reference number</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>CASE REFERENCE</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. STV-2026-0006"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => runSearch(query)}
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: "#1A3A6C" }, !query.trim() && { opacity: 0.5 }]}
            onPress={() => runSearch(query)}
            disabled={!query.trim()}
            activeOpacity={0.85}
          >
            <Feather name="search" size={16} color="#fff" />
            <Text style={styles.searchBtnText}>Track Report</Text>
          </TouchableOpacity>
        </View>

        {searched && !result && (
          <View style={[styles.notFound, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
            <Text style={[styles.notFoundTitle, { color: colors.text }]}>No report found</Text>
            <Text style={[styles.notFoundSub, { color: colors.mutedForeground }]}>
              Check your reference number and try again. It looks like STV-YYYY-NNNN.
            </Text>
          </View>
        )}

        {result && (
          <>
            {(() => {
              const st = currentState(result);
              return (
                <View style={[styles.statusBanner, { backgroundColor: st.color + "14", borderColor: st.color + "40" }]}>
                  <View style={[styles.statusIcon, { backgroundColor: st.color + "22" }]}>
                    <Feather name={st.icon} size={22} color={st.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
                    <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>{st.sub}</Text>
                  </View>
                </View>
              );
            })()}

            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.refValue, { color: colors.text }]}>{result.reference}</Text>
              <View style={[styles.plateBadge, { borderColor: "#DAA520", backgroundColor: "#FFF8DC" }]}>
                <Text style={styles.plateText}>{result.plate}</Text>
              </View>
              <Text style={[styles.vehicleLine, { color: colors.text }]}>
                {[result.year, result.color, result.make, result.model].filter(Boolean).join(" ")}
              </Text>
              <Text style={[styles.locLine, { color: colors.mutedForeground }]}>
                <Feather name="map-pin" size={12} /> {result.location}
              </Text>
              <Text style={[styles.reportedLine, { color: colors.mutedForeground }]}>
                Reported {formatMinutesAgo(result.reportedAt)}
              </Text>
            </View>

            <Text style={[styles.timelineHeading, { color: colors.text }]}>Case Timeline</Text>
            <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[...result.history].reverse().map((ev, i, arr) => (
                <View key={`${ev.at}-${i}`} style={styles.timelineRow}>
                  <View style={styles.timelineDotCol}>
                    <View style={[styles.timelineDot, { backgroundColor: i === 0 ? "#1A3A6C" : colors.border }]} />
                    {i < arr.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <Text style={[styles.timelineLabel, { color: colors.text }]}>{ACTION_LABEL[ev.action]}</Text>
                    <Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>
                      {new Date(ev.at).toLocaleString()}
                      {ev.by ? ` · ${ev.by}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  scroll: { padding: 16, gap: 14 },
  searchCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, marginTop: 12 },
  searchBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  notFound: { alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 24, gap: 8 },
  notFoundTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  notFoundSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statusSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  detailCard: { borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center", gap: 8 },
  refValue: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  plateBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  plateText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 1 },
  vehicleLine: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  locLine: { fontSize: 12, fontFamily: "Inter_400Regular" },
  reportedLine: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timelineHeading: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 4 },
  timelineCard: { borderWidth: 1, borderRadius: 16, padding: 16, paddingBottom: 2 },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineDotCol: { alignItems: "center", width: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  timelineLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  timelineMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
