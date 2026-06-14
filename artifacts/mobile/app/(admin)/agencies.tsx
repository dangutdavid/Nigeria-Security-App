import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CitizenAgencyRoute, formatCitizenAgencyLabel, listCitizenIncidentReports } from "@/services/citizenIncidentApi";

const AGENCIES: CitizenAgencyRoute[] = ["frsc", "police", "vio", "civil_defence"];

export default function AdminAgenciesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listCitizenIncidentReports>>>([]);
  useFocusEffect(useCallback(() => { void listCitizenIncidentReports().then(setReports); }, []));
  const rows = useMemo(() => AGENCIES.map((agency) => {
    const agencyReports = reports.filter((r) => r.suggestedAgency === agency);
    return {
      agency,
      total: agencyReports.length,
      open: agencyReports.filter((r) => r.status !== "resolved" && r.status !== "closed").length,
      resolved: agencyReports.filter((r) => r.status === "resolved" || r.status === "closed").length,
      high: agencyReports.filter((r) => r.emergencyLevel === "high" || r.emergencyLevel === "critical").length,
    };
  }), [reports]);
  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}>
      <Text style={[styles.title, { color: colors.text }]}>Agency workload</Text>
      {rows.map((row) => (
        <View key={row.agency} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{formatCitizenAgencyLabel(row.agency)}</Text>
          <View style={styles.grid}>
            <Stat label="Total" value={row.total} />
            <Stat label="Open" value={row.open} />
            <Stat label="Resolved" value={row.resolved} />
            <Stat label="High priority" value={row.high} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "47%", backgroundColor: "#34405410", borderRadius: 12, padding: 12 },
  statValue: { color: "#344054", fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { color: "#667085", fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
});
