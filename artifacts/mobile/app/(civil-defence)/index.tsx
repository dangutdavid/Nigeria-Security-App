import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MetricCard } from "@/components/MetricCard";
import { NotificationAccessCard } from "@/components/NotificationAccessCard";
import { useAuth } from "@/context/AuthContext";
import { useReferrals } from "@/context/ReferralContext";
import { useColors } from "@/hooks/useColors";
import { CitizenIncidentReceipt } from "@/services/citizenIncidentApi";
import { listReportsByAgency } from "@/services/reportRepository";

export default function CivilDefenceHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { inboxFor } = useReferrals();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setReports(await listReportsByAgency("civil_defence")), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const referrals = user ? inboxFor("civil_defence") : [];
  const metrics = useMemo(() => ({
    newReports: reports.filter((r) => r.status === "submitted").length,
    high: reports.filter((r) => r.emergencyLevel === "high" || r.emergencyLevel === "critical").length,
    active: reports.filter((r) => r.status === "assigned" || r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved" || r.status === "closed").length,
    referrals: referrals.filter((r) => r.status !== "closed").length,
  }), [reports, referrals]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#234E2A" />}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>Civil Defence / NSCDC</Text>
        <Text style={styles.heroTitle}>Welcome, {user?.name.split(" ")[0] ?? "Officer"}</Text>
        <Text style={styles.heroSub}>Civil protection, emergency response, and community safety operations.</Text>
      </View>

      <NotificationAccessCard accentColor="#234E2A" />

      <View style={styles.metricRow}>
        <MetricCard label="New citizen reports" value={metrics.newReports} icon="inbox" color="#234E2A" bgColor="#234E2A18" />
        <MetricCard label="High priority" value={metrics.high} icon="alert-octagon" color="#C0392B" bgColor="#FEE8E8" />
      </View>
      <View style={styles.metricRow}>
        <MetricCard label="Assigned / active" value={metrics.active} icon="activity" color="#7C3AED" bgColor="#7C3AED18" />
        <MetricCard label="Resolved" value={metrics.resolved} icon="check-circle" color="#27AE60" bgColor="#E8F8EE" />
      </View>
      <View style={styles.metricRow}>
        <MetricCard label="Open referrals" value={metrics.referrals} icon="git-pull-request" color="#C8960C" bgColor="#FFF8DC" />
        <MetricCard label="Emergency alerts" value={metrics.high + metrics.newReports} icon="bell" color="#D35400" bgColor="#D3540018" />
      </View>

      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(civil-defence)/incidents" as any)}>
          <Feather name="shield" size={18} color="#fff" />
          <Text style={styles.primaryText}>Open incidents</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/(civil-defence)/alerts" as any)}>
          <Feather name="bell" size={18} color="#234E2A" />
          <Text style={styles.secondaryText}>Alerts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT NSCDC REPORTS</Text>
        <TouchableOpacity onPress={() => router.push("/(civil-defence)/incidents" as any)}>
          <Text style={styles.linkText}>See all</Text>
        </TouchableOpacity>
      </View>
      {reports.slice(0, 3).map((report) => (
        <View key={report.reference} style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.reportTitle, { color: colors.text }]}>{report.reference}</Text>
          <Text style={[styles.reportMeta, { color: colors.mutedForeground }]}>{report.incidentType.replaceAll("_", " ")} · {report.status.replaceAll("_", " ")}</Text>
          <Text style={[styles.reportDesc, { color: colors.text }]} numberOfLines={2}>{report.description}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { backgroundColor: "#234E2A", borderRadius: 22, padding: 18, marginBottom: 14 },
  kicker: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  heroTitle: { color: "#fff", fontSize: 25, fontFamily: "Inter_700Bold", marginTop: 8 },
  heroSub: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 6 },
  metricRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 18 },
  primaryBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: "#234E2A", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  secondaryBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { color: "#234E2A", fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  linkText: { color: "#234E2A", fontSize: 12, fontFamily: "Inter_700Bold" },
  reportCard: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10 },
  reportTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  reportMeta: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize", marginTop: 3 },
  reportDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 18 },
});
