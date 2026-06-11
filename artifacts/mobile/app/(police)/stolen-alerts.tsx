import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useTheftReports, formatMinutesAgo, getAlertRadiusMiles } from "@/context/TheftReportContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#1A3A6C";

const STAGE_LABEL: Record<string, string> = {
  new: "New report",
  acknowledged: "Acknowledged",
  investigating: "Under investigation",
};

export default function PoliceStolenAlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reports: theftReports, updateReportStatus, advanceStage } = useTheftReports();
  const { user } = useAuth();
  const officerName = user?.name;

  const active = [...theftReports]
    .filter((r) => r.status === "active")
    .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY }]}>
        <Text style={styles.headerTitle}>Stolen Vehicle Alerts</Text>
        <Text style={styles.headerSub}>{active.length} active report{active.length !== 1 ? "s" : ""} — nationwide</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.mapLink, { backgroundColor: "#C0392B12", borderColor: "#C0392B30" }]}
          onPress={() => router.push("/theft-alerts" as any)}
          activeOpacity={0.85}
        >
          <Feather name="map-pin" size={16} color="#C0392B" />
          <Text style={styles.mapLinkText}>View on Map with Location-Based Radius Alerts</Text>
          <Feather name="arrow-right" size={14} color="#C0392B" />
        </TouchableOpacity>

        {active.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active stolen vehicle reports</Text>
          </View>
        ) : (
          active.map((r) => {
            const radius = getAlertRadiusMiles(new Date(r.reportedAt).getTime());
            return (
              <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
                    <Text style={styles.plateText}>{r.plate}</Text>
                  </View>
                  <View style={[styles.radiusBadge, { backgroundColor: PRIMARY + "18" }]}>
                    <Feather name="radio" size={12} color={PRIMARY} />
                    <Text style={[styles.radiusText, { color: PRIMARY }]}>{radius} mi radius</Text>
                  </View>
                  <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{formatMinutesAgo(r.reportedAt)}</Text>
                </View>
                <Text style={[styles.refText, { color: colors.mutedForeground }]}>
                  {r.reference} · {STAGE_LABEL[r.stage] ?? "New report"}
                </Text>
                <Text style={[styles.vehicleDesc, { color: colors.text }]}>
                  {r.year} {r.color} {r.make} {r.model}
                </Text>
                <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
                  <Feather name="map-pin" size={12} color={colors.mutedForeground} /> {r.location}
                </Text>
                {r.description ? (
                  <Text style={[styles.descText, { color: colors.mutedForeground }]} numberOfLines={2}>{r.description}</Text>
                ) : null}
                {r.reporterName ? (
                  <Text style={[styles.reporterText, { color: colors.mutedForeground }]}>
                    Reporter: {r.reporterName} {r.contactPhone ? `· ${r.contactPhone}` : ""}
                  </Text>
                ) : null}
                {r.stage !== "investigating" && (
                  <View style={styles.actions}>
                    {r.stage === "new" && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#E67E2218", borderColor: "#E67E2233" }]}
                        onPress={() => advanceStage(r.id, "acknowledged", officerName, "police")}
                      >
                        <Feather name="eye" size={14} color="#E67E22" />
                        <Text style={[styles.actionText, { color: "#E67E22" }]}>Acknowledge</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: PRIMARY + "18", borderColor: PRIMARY + "33" }]}
                      onPress={() => advanceStage(r.id, "investigating", officerName, "police")}
                    >
                      <Feather name="search" size={14} color={PRIMARY} />
                      <Text style={[styles.actionText, { color: PRIMARY }]}>Start Investigation</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#388E3C18", borderColor: "#388E3C33" }]}
                    onPress={() => updateReportStatus(r.id, "recovered", officerName, "police")}
                  >
                    <Feather name="check" size={14} color="#388E3C" />
                    <Text style={[styles.actionText, { color: "#388E3C" }]}>Mark Recovered</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={() => updateReportStatus(r.id, "false_alarm", officerName, "police")}
                  >
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.actionText, { color: colors.mutedForeground }]}>False Alarm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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
  content: { padding: 16, gap: 12 },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  mapLinkText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C0392B" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  plateBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  plateText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 1 },
  radiusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  radiusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  timeText: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  refText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  vehicleDesc: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  locationText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  descText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  reporterText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
