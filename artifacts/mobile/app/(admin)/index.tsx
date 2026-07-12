import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MetricCard } from "@/components/MetricCard";
import { NotificationAccessCard } from "@/components/NotificationAccessCard";
import { useReferrals } from "@/context/ReferralContext";
import { useColors } from "@/hooks/useColors";
import { CitizenIncidentReceipt } from "@/services/citizenIncidentApi";
import { listReports } from "@/services/reportRepository";

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { referrals } = useReferrals();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => setReports(await listReports()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const metrics = useMemo(() => {
    const byAgency = (agency: string) => reports.filter((r) => r.suggestedAgency === agency).length;
    return {
      total: reports.length,
      frsc: byAgency("frsc"),
      police: byAgency("police"),
      vio: byAgency("vio"),
      nscdc: byAgency("civil_defence"),
      high: reports.filter((r) => r.emergencyLevel === "high" || r.emergencyLevel === "critical").length,
      triage: reports.filter((r) => r.status === "submitted").length,
      progress: reports.filter((r) => r.status === "in_progress" || r.status === "assigned").length,
      resolved: reports.filter((r) => r.status === "resolved" || r.status === "closed").length,
    };
  }, [reports]);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.hero}><Text style={styles.kicker}>ADMIN CONTROL</Text><Text style={styles.heroTitle}>Cross-agency overview</Text><Text style={styles.heroSub}>Citizen reports, agency workload, referrals, users, and activity.</Text></View>
      <NotificationAccessCard accentColor="#344054" />
      <View style={styles.row}><MetricCard label="Total citizen reports" value={metrics.total} icon="file-text" color="#344054" bgColor="#34405418" /><MetricCard label="High emergency" value={metrics.high} icon="alert-octagon" color="#C0392B" bgColor="#FEE8E8" /></View>
      <View style={styles.row}><MetricCard label="Pending triage" value={metrics.triage} icon="clock" color="#C8960C" bgColor="#FFF8DC" /><MetricCard label="In progress" value={metrics.progress} icon="activity" color="#7C3AED" bgColor="#7C3AED18" /></View>
      <View style={styles.row}><MetricCard label="Resolved / closed" value={metrics.resolved} icon="check-circle" color="#27AE60" bgColor="#E8F8EE" /><MetricCard label="Referrals" value={referrals.length} icon="git-pull-request" color="#2C7BE5" bgColor="#2C7BE518" /></View>
      <View style={[styles.agencyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Reports by agency</Text>
        {[["FRSC", metrics.frsc], ["Police", metrics.police], ["VIO", metrics.vio], ["NSCDC", metrics.nscdc]].map(([label, value]) => <View key={label} style={styles.agencyRow}><Text style={[styles.agencyLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.agencyValue, { color: colors.text }]}>{value}</Text></View>)}
      </View>
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(admin)/incidents" as any)}><Feather name="file-text" size={17} color="#fff" /><Text style={styles.primaryText}>All incidents</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/(admin)/agencies" as any)}><Feather name="bar-chart-2" size={17} color="#344054" /><Text style={styles.secondaryText}>Workload</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.auditBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/(admin)/audit" as any)}>
        <Feather name="activity" size={17} color="#344054" />
        <Text style={styles.secondaryText}>Open audit trail</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { backgroundColor: "#344054", borderRadius: 22, padding: 18, marginBottom: 14 },
  kicker: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  heroTitle: { color: "#fff", fontSize: 25, fontFamily: "Inter_700Bold", marginTop: 8 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, marginTop: 6 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  agencyCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginVertical: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  agencyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  agencyLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  agencyValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  auditBtn: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  primaryBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: "#344054", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  secondaryBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { color: "#344054", fontSize: 14, fontFamily: "Inter_700Bold" },
});
