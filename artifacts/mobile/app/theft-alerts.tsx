import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  formatMinutesAgo,
  getAlertRadiusMiles,
  NearbyTheftAlert,
  useTheftReports,
} from "@/context/TheftReportContext";

function RadiusBadge({ minutes }: { minutes: number }) {
  let radius: number;
  let color: string;
  let label: string;
  if (minutes < 30) { radius = 2; color = "#1B5E3B"; label = "2 mi"; }
  else if (minutes < 120) { radius = 5; color = "#E67E22"; label = "5 mi"; }
  else if (minutes < 360) { radius = 10; color = "#C0392B"; label = "10 mi"; }
  else { radius = 20; color = "#8B0000"; label = "20 mi"; }
  void radius;
  return (
    <View style={[styles.radiusBadge, { backgroundColor: color + "18" }]}>
      <Feather name="radio" size={10} color={color} />
      <Text style={[styles.radiusBadgeText, { color }]}>{label} alert</Text>
    </View>
  );
}

function TheftCard({
  report,
  onMarkRecovered,
  onMarkFalseAlarm,
}: {
  report: NearbyTheftAlert;
  onMarkRecovered: (id: string) => void;
  onMarkFalseAlarm: (id: string) => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: "#C0392B30" }]}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setExpanded((v) => !v);
      }}
      activeOpacity={0.9}
    >
      <View style={styles.cardTop}>
        <View style={[styles.alertDot, { backgroundColor: "#C0392B" }]} />
        <View style={[styles.plateBox, { borderColor: "#C8960C", backgroundColor: "#FFF8DC" }]}>
          <Text style={styles.plateText}>{report.plate}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.vehicleTitle, { color: colors.text }]}>
            {[report.color, report.make, report.model].filter(Boolean).join(" ")}
            {report.year ? ` (${report.year})` : ""}
          </Text>
          <Text style={[styles.timeAgo, { color: "#C0392B" }]}>{formatMinutesAgo(report.reportedAt)}</Text>
        </View>
        <RadiusBadge minutes={report.minutesElapsed} />
      </View>

      <View style={styles.locationRow}>
        <Feather name="map-pin" size={12} color="#C0392B" />
        <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
          {report.location}
        </Text>
        {report.distanceMiles > 0 && (
          <Text style={[styles.distText, { color: colors.primary }]}>
            {report.distanceMiles < 1
              ? `${(report.distanceMiles * 1760).toFixed(0)} yd`
              : `${report.distanceMiles.toFixed(1)} mi`}
          </Text>
        )}
      </View>

      {expanded && (
        <>
          {report.photoUri && (
            <Image
              source={{ uri: report.photoUri }}
              style={styles.photo}
              resizeMode="cover"
            />
          )}
          <Text style={[styles.description, { color: colors.text }]}>{report.description}</Text>

          {report.reporterName && report.reporterName !== "Anonymous" && (
            <View style={styles.reporterRow}>
              <Feather name="user" size={12} color={colors.mutedForeground} />
              <Text style={[styles.reporterText, { color: colors.mutedForeground }]}>
                Reported by {report.reporterName}
                {report.contactPhone ? ` · ${report.contactPhone}` : ""}
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#1B5E3B" }]}
              onPress={() => onMarkRecovered(report.id)}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Recovered</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#6B7A8A" }]}
              onPress={() => onMarkFalseAlarm(report.id)}
              activeOpacity={0.85}
            >
              <Feather name="x-circle" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>False Alarm</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function TheftAlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    nearbyAlerts,
    reports,
    userLocation,
    locationPermission,
    requestLocationPermission,
    updateReportStatus,
  } = useTheftReports();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const activeCount = reports.filter((r) => r.status === "active").length;

  function handleMarkRecovered(id: string) {
    Alert.alert("Mark as Recovered", "Has this vehicle been recovered?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Recovered",
        style: "default",
        onPress: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void updateReportStatus(id, "recovered");
        },
      },
    ]);
  }

  function handleMarkFalseAlarm(id: string) {
    Alert.alert("False Alarm", "Mark this report as a false alarm?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () => void updateReportStatus(id, "false_alarm"),
      },
    ]);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: "#C0392B", paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Stolen Vehicle Alerts</Text>
            <Text style={styles.headerSub}>
              {activeCount} active report{activeCount !== 1 ? "s" : ""}
              {userLocation ? ` · ${nearbyAlerts.length} nearby` : " · Location off"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.35)" }]}
            onPress={() => router.push("/report-theft" as any)}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.reportBtnText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Radius legend */}
        <View style={styles.legend}>
          {[
            { label: "< 30m", radius: "2 mi", color: "#6EE39B" },
            { label: "30m–2h", radius: "5 mi", color: "#FFC97A" },
            { label: "2–6h", radius: "10 mi", color: "#FF8A80" },
            { label: "> 6h", radius: "20 mi", color: "#EF9A9A" },
          ].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label} → {l.radius}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Location permission banner */}
      {locationPermission !== "granted" && (
        <TouchableOpacity
          style={[styles.locBanner, { backgroundColor: "#FFF3E0", borderColor: "#E67E22" }]}
          onPress={() => void requestLocationPermission()}
          activeOpacity={0.85}
        >
          <Feather name="map-pin" size={16} color="#E67E22" />
          <View style={{ flex: 1 }}>
            <Text style={styles.locBannerTitle}>Enable Location for Nearby Alerts</Text>
            <Text style={styles.locBannerSub}>Tap to enable — we show you only alerts within your radius</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#E67E22" />
        </TouchableOpacity>
      )}

      <FlatList
        data={userLocation ? nearbyAlerts : reports.filter((r) => r.status === "active").map((r) => ({
          ...r,
          distanceMiles: 0,
          alertRadiusMiles: getAlertRadiusMiles(new Date(r.reportedAt).getTime()),
          minutesElapsed: Math.floor((Date.now() - new Date(r.reportedAt).getTime()) / 60000),
        }))}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPad, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Alerts</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {locationPermission === "granted"
                ? "No stolen vehicles reported near your location right now."
                : "Enable location to see nearby alerts."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TheftCard
            report={item as NearbyTheftAlert}
            onMarkRecovered={handleMarkRecovered}
            onMarkFalseAlarm={handleMarkFalseAlarm}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", marginTop: 1 },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  reportBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium" },
  locBanner: { flexDirection: "row", alignItems: "center", gap: 12, margin: 14, borderRadius: 14, borderWidth: 1, padding: 14 },
  locBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#E67E22" },
  locBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#555", marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 12, gap: 0 },
  alertDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  plateBox: { borderWidth: 2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#C8960C" },
  vehicleTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  timeAgo: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  radiusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  radiusBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  locationText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  distText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  photo: { width: "100%", height: 180 },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", padding: 12, lineHeight: 20 },
  reporterRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  reporterText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 10, padding: 12, paddingTop: 0 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
});
