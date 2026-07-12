import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReferrals } from "@/context/ReferralContext";
import { useColors } from "@/hooks/useColors";
import { CitizenIncidentReceipt, listNscdcCitizenIncidentReports } from "@/services/citizenIncidentApi";

export default function CivilDefenceAlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { inboxFor } = useReferrals();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  useFocusEffect(useCallback(() => { void listNscdcCitizenIncidentReports().then(setReports); }, []));
  const referrals = inboxFor("civil_defence");
  const alerts = useMemo(() => [
    ...reports.filter((r) => r.status === "submitted" || r.emergencyLevel === "critical" || r.emergencyLevel === "high").map((r) => ({
      id: r.reference,
      title: r.emergencyLevel === "critical" ? "Critical civil emergency" : "Citizen report awaiting action",
      text: `${r.reference} · ${r.location}`,
      color: r.emergencyLevel === "critical" ? "#C0392B" : "#234E2A",
    })),
    ...referrals.filter((r) => r.status === "pending").map((r) => ({
      id: r.id,
      title: "Agency referral received",
      text: `${r.fromAgency.toUpperCase()} → NSCDC · ${r.snapshot.title}`,
      color: "#C8960C",
    })),
  ], [reports, referrals]);

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}>
      <Text style={[styles.title, { color: colors.text }]}>Alerts</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Emergency, civil protection, and referral notifications.</Text>
      {alerts.map((alert) => (
        <View key={alert.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: alert.color + "18" }]}>
            <Feather name="bell" size={18} color={alert.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.text }]}>{alert.title}</Text>
            <Text style={[styles.alertText, { color: colors.mutedForeground }]}>{alert.text}</Text>
          </View>
        </View>
      ))}
      {alerts.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>No active NSCDC alerts.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 8 },
  sub: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12, alignItems: "center" },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  alertText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3, lineHeight: 17 },
  empty: { textAlign: "center", marginTop: 32, fontFamily: "Inter_600SemiBold" },
});
