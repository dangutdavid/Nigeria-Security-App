import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useInspections } from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";
import { NotificationAccessCard } from "@/components/NotificationAccessCard";
import { useAgencyBrand } from "@/context/AgencyContext";
import {
  CitizenIncidentReceipt,
  formatCitizenIncidentStatus,
} from "@/services/citizenIncidentApi";
import { listReportsByAgency } from "@/services/reportRepository";

const FALLBACK_PRIMARY = "#7B3F00";

const RESULT_COLORS: Record<string, string> = {
  pass: "#388E3C",
  fail: "#E53935",
  conditional: "#F57C00",
};

const CITIZEN_STATUS_COLORS: Record<string, string> = {
  submitted: "#E53935",
  triaged: "#F57C00",
  assigned: FALLBACK_PRIMARY,
  in_progress: "#1565C0",
  resolved: "#388E3C",
  closed: "#9E9E9E",
};

function formatIncidentType(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function VIOHome() {
  const colors = useColors();
  const { primary: PRIMARY } = useAgencyBrand("vio", { primary: FALLBACK_PRIMARY });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { inspections } = useInspections();
  const [citizenReports, setCitizenReports] = useState<CitizenIncidentReceipt[]>([]);

  const loadCitizenReports = useCallback(async () => {
    setCitizenReports(await listReportsByAgency("vio"));
  }, []);

  useFocusEffect(useCallback(() => { void loadCitizenReports(); }, [loadCitizenReports]));

  const today = new Date().toDateString();
  const todayInspections = inspections.filter((i) => new Date(i.inspectedAt).toDateString() === today);

  const stats = useMemo(() => ({
    today: todayInspections.length + citizenReports.filter((r) => new Date(r.submittedAt).toDateString() === today).length,
    pass: inspections.filter((i) => i.result === "pass").length,
    fail: inspections.filter((i) => i.result === "fail").length + citizenReports.filter((r) => (r.emergencyLevel === "high" || r.emergencyLevel === "critical") && r.status !== "resolved" && r.status !== "closed").length,
    conditional: inspections.filter((i) => i.result === "conditional").length + citizenReports.filter((r) => r.status === "triaged" || r.status === "assigned").length,
    total: inspections.length + citizenReports.length,
    passRate: inspections.length > 0 ? Math.round((inspections.filter((i) => i.result === "pass").length / inspections.length) * 100) : 0,
    citizen: citizenReports.length,
  }), [inspections, todayInspections, citizenReports, today]);

  const recent = useMemo(() =>
    [...inspections].sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime()).slice(0, 3),
    [inspections]
  );

  const recentCitizenReports = useMemo(
    () => [...citizenReports].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 3),
    [citizenReports],
  );

  const quickActions = [
    { icon: "plus-circle" as const, label: "New Inspection", color: PRIMARY, route: "/(vio)/new-inspection" },
    { icon: "clipboard" as const, label: "All Inspections", color: "#37474F", route: "/(vio)/inspections" },
    { icon: "award" as const, label: "Certificates", color: "#1565C0", route: "/(vio)/certificates" },
    { icon: "truck" as const, label: "Vehicle Lookup", color: "#6A1B9A", route: "/vehicle-lookup" },
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
              <Text style={styles.heroLabel}>Vehicle Inspection Officers</Text>
              <Text style={styles.heroName}>{user?.name ?? "Officer"}</Text>
              <Text style={styles.heroBadge}>{user?.badgeNumber} · {user?.station}</Text>
            </View>
            <View style={[styles.vioBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Feather name="clipboard" size={28} color="#fff" />
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.today}</Text>
              <Text style={styles.heroStatLabel}>Today</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.pass}</Text>
              <Text style={styles.heroStatLabel}>Passed</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.fail}</Text>
              <Text style={styles.heroStatLabel}>Failed</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{stats.passRate}%</Text>
              <Text style={styles.heroStatLabel}>Pass Rate</Text>
            </View>
          </View>
        </View>

        <NotificationAccessCard accentColor={PRIMARY} />

        {/* Failed inspections alert */}
        {stats.fail > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: "#FFEBEE", borderColor: "#FFCDD2" }]}>
            <Feather name="alert-circle" size={16} color="#C62828" />
            <Text style={styles.alertText}>
              {stats.fail} vehicle{stats.fail !== 1 ? "s" : ""} failed inspection — follow-up required
            </Text>
          </View>
        )}

        {stats.citizen > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Citizen Vehicle Reports</Text>
              <TouchableOpacity onPress={() => router.push("/(vio)/inspections" as any)}>
                <Text style={[styles.seeAll, { color: PRIMARY }]}>Review</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 10 }}>
              {recentCitizenReports.map((report) => (
                <TouchableOpacity
                  key={report.reference}
                  style={[styles.inspectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push("/(vio)/inspections" as any)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.resultDot, { backgroundColor: CITIZEN_STATUS_COLORS[report.status] ?? PRIMARY }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
                        <Text style={styles.plateText}>{report.vehicleRegistration ?? report.reference}</Text>
                      </View>
                      <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>{timeAgo(report.submittedAt)}</Text>
                    </View>
                    <Text style={[styles.vehicleDesc, { color: colors.text }]}>{formatIncidentType(report.incidentType)}</Text>
                    <View style={styles.cardBottom}>
                      <View style={[styles.resultBadge, { backgroundColor: (CITIZEN_STATUS_COLORS[report.status] ?? PRIMARY) + "22" }]}>
                        <Text style={[styles.resultText, { color: CITIZEN_STATUS_COLORS[report.status] ?? PRIMARY }]}>
                          {formatCitizenIncidentStatus(report.status)}
                        </Text>
                      </View>
                      <Text style={[styles.certNum, { color: colors.mutedForeground }]}>Citizen Report</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((a) => (
              <TouchableOpacity
                key={a.route}
                style={[styles.actionCard, { backgroundColor: a.color }]}
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

        {/* Recent Inspections */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Inspections</Text>
            <TouchableOpacity onPress={() => router.push("/(vio)/inspections" as any)}>
              <Text style={[styles.seeAll, { color: PRIMARY }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="clipboard" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No inspections yet</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recent.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.inspectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/inspection/${r.id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.resultDot, { backgroundColor: RESULT_COLORS[r.result] }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
                        <Text style={styles.plateText}>{r.plate}</Text>
                      </View>
                      <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>{timeAgo(r.inspectedAt)}</Text>
                    </View>
                    <Text style={[styles.vehicleDesc, { color: colors.text }]}>{r.year} {r.color} {r.make} {r.model}</Text>
                    <View style={styles.cardBottom}>
                      <View style={[styles.resultBadge, { backgroundColor: RESULT_COLORS[r.result] + "22" }]}>
                        <Text style={[styles.resultText, { color: RESULT_COLORS[r.result] }]}>
                          {r.result.charAt(0).toUpperCase() + r.result.slice(1)}
                        </Text>
                      </View>
                      {r.certNumber && (
                        <Text style={[styles.certNum, { color: colors.mutedForeground }]}>{r.certNumber}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 0 },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  heroName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroBadge: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 3 },
  vioBadge: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroStats: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 14 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2, textAlign: "center" },
  heroStatDivider: { width: 1, marginVertical: 4 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 12 },
  alertText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C62828", flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: { borderRadius: 16, padding: 16, gap: 10, width: "47%" },
  actionIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: "center", gap: 10, borderStyle: "dashed" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inspectionCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  resultDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, flexShrink: 0 },
  plateBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 1 },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  vehicleDesc: { fontSize: 13, fontFamily: "Inter_500Medium" },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  resultText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  certNum: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
