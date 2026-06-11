import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useCrimeReports, CRIME_TYPE_LABELS, CrimeType } from "@/context/CrimeReportContext";
import { useTheftReports } from "@/context/TheftReportContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#1A3A6C";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  open: "#E53935",
  investigating: "#F57C00",
  arrested: "#388E3C",
  closed: "#9E9E9E",
};

const SEV_COLORS: Record<string, string> = {
  minor: "#9E9E9E",
  moderate: "#F57C00",
  serious: "#E53935",
  critical: "#880E4F",
};

export default function PoliceHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { reports } = useCrimeReports();
  const { reports: theftReports } = useTheftReports();

  const isSupervisor = user?.role === "supervisor" || user?.role === "commander";

  const stats = useMemo(() => ({
    open: reports.filter((r) => r.status === "open").length,
    investigating: reports.filter((r) => r.status === "investigating").length,
    arrested: reports.filter((r) => r.status === "arrested").length,
    closed: reports.filter((r) => r.status === "closed").length,
    stolen: theftReports.filter((r: { status: string }) => r.status === "active").length,
    critical: reports.filter((r) => r.severity === "critical" && r.status !== "closed").length,
  }), [reports, theftReports]);

  const recent = useMemo(() =>
    [...reports].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()).slice(0, 3),
    [reports]
  );

  const quickActions = [
    { icon: "file-text" as const, label: "New Crime Report", color: PRIMARY, route: "/crime-reports" },
    { icon: "truck" as const, label: "Vehicle Check", color: "#37474F", route: "/vehicle-check" },
    { icon: "alert-triangle" as const, label: "Stolen Vehicles", color: "#C0392B", route: "/stolen-alerts" },
    { icon: "users" as const, label: "Manage Officers", color: "#5C6BC0", route: "/users", supervisorOnly: true },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: PRIMARY }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>Nigeria Police Force</Text>
              <Text style={styles.heroName}>{user?.name ?? "Officer"}</Text>
              <Text style={styles.heroBadge}>{user?.badgeNumber} · {user?.station}</Text>
            </View>
            <View style={[styles.shieldBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Feather name="star" size={28} color="#fff" />
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.open}</Text>
              <Text style={styles.heroStatLabel}>Open</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.investigating}</Text>
              <Text style={styles.heroStatLabel}>Active</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.arrested}</Text>
              <Text style={styles.heroStatLabel}>Arrested</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.stolen}</Text>
              <Text style={styles.heroStatLabel}>Stolen Vehicles</Text>
            </View>
          </View>
        </View>

        {/* Critical alert */}
        {stats.critical > 0 && (
          <View style={[styles.criticalBanner, { backgroundColor: "#880E4F18", borderColor: "#880E4F30" }]}>
            <Feather name="alert-octagon" size={16} color="#880E4F" />
            <Text style={[styles.criticalText, { color: "#880E4F" }]}>
              {stats.critical} critical case{stats.critical !== 1 ? "s" : ""} requiring immediate attention
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions
              .filter((a) => !a.supervisorOnly || isSupervisor)
              .map((a) => (
                <TouchableOpacity
                  key={a.route}
                  style={[styles.actionCard, { backgroundColor: a.color, flex: 1, minWidth: "45%" }]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(a.route as any);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                    <Feather name={a.icon} size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>

        {/* Recent Crime Reports */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Reports</Text>
            <TouchableOpacity onPress={() => router.push("/(police)/crime-reports" as any)}>
              <Text style={[styles.seeAll, { color: PRIMARY }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No crime reports yet</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recent.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/crime/${r.id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.sevDot, { backgroundColor: SEV_COLORS[r.severity] ?? "#9E9E9E" }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.reportCardTop}>
                      <Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
                      <Text style={[styles.reportTime, { color: colors.mutedForeground }]}>{timeAgo(r.reportedAt)}</Text>
                    </View>
                    <Text style={[styles.reportType, { color: colors.mutedForeground }]}>
                      {CRIME_TYPE_LABELS[r.crimeType as CrimeType]} · {r.location}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[r.status] + "22" }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[r.status] }]}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Stolen Vehicles Banner */}
        {stats.stolen > 0 && (
          <TouchableOpacity
            style={[styles.stolenBanner, { backgroundColor: "#C0392B12", borderColor: "#C0392B30" }]}
            onPress={() => router.push("/theft-alerts" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.stolenIcon, { backgroundColor: "#C0392B22" }]}>
              <Feather name="radio" size={18} color="#C0392B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stolenTitle}>{stats.stolen} Active Stolen Vehicle Report{stats.stolen !== 1 ? "s" : ""}</Text>
              <Text style={styles.stolenSub}>Tap to view broadcast alerts & location data</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#C0392B" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 0, gap: 0 },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroGreeting: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  heroName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroBadge: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 3 },
  shieldBadge: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroStats: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 14, gap: 0 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2, textAlign: "center" },
  heroStatDivider: { width: 1, marginVertical: 4 },
  criticalBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 12 },
  criticalText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: { borderRadius: 16, padding: 16, gap: 10, flexDirection: "column" },
  actionIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: "center", gap: 10, borderStyle: "dashed" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  reportCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  sevDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  reportCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  reportTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  reportTime: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  reportType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stolenBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 8, marginBottom: 4, borderRadius: 14, borderWidth: 1, padding: 14 },
  stolenIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stolenTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#C0392B" },
  stolenSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#8B0000", marginTop: 2 },
});
