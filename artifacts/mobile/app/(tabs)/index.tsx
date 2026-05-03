import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";
import { IncidentCard } from "@/components/IncidentCard";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { incidents } = useIncidents();

  const myReports = incidents.filter((incident) => incident.reportedBy === "u1");
  const recent = incidents.slice(0, 5);
  const openCount = incidents.filter((incident) => incident.status !== "closed").length;
  const fatalCount = incidents.filter((incident) => incident.severity === "fatal" && incident.status !== "closed").length;
  const bySeverity = [
    { key: "fatal", label: "Fatal", value: incidents.filter((incident) => incident.severity === "fatal").length, color: "#8B0000" },
    { key: "serious", label: "Serious", value: incidents.filter((incident) => incident.severity === "serious").length, color: "#E67E22" },
    { key: "minor", label: "Minor", value: incidents.filter((incident) => incident.severity === "minor").length, color: "#27AE60" },
  ];
  const byStatus = [
    { key: "submitted", label: "Submitted", value: incidents.filter((incident) => incident.status === "submitted").length, color: colors.primary },
    { key: "assigned", label: "Assigned", value: incidents.filter((incident) => incident.status === "assigned").length, color: colors.secondary },
    { key: "review", label: "Under review", value: incidents.filter((incident) => incident.status === "under_review").length, color: colors.warning },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.kicker}>FRSC Field Operations</Text>
              <Text style={styles.heroTitle}>Live duty overview</Text>
              <Text style={styles.heroSub}>Offline-first incident tracking and rapid reporting</Text>
            </View>
            <View style={styles.heroBadge}>
              <Feather name="shield" size={18} color={colors.primary} />
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{openCount}</Text>
              <Text style={styles.statLabel}>Open cases</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{fatalCount}</Text>
              <Text style={styles.statLabel}>Critical</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{myReports.length}</Text>
              <Text style={styles.statLabel}>My reports</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>REPORT CHARTS</Text>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>Tap a bar to filter</Text>
          </View>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Severity breakdown</Text>
            <View style={styles.severityList}>
              {bySeverity.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.severityRow}
                  onPress={() => router.push(`/(tabs)/cases?severity=${item.key}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.severityLeft}>
                    <View style={[styles.severityDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.statusLabel, { color: colors.text }]}>{item.label}</Text>
                  </View>
                  <View style={styles.severityBarTrack}>
                    <View
                      style={[
                        styles.severityBarFill,
                        { width: `${Math.max(18, item.value ? item.value * 20 : 18)}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.severityValue, { color: colors.text }]}>{item.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Status snapshot</Text>
            {byStatus.map((item) => (
              <TouchableOpacity key={item.key} style={styles.statusRow} onPress={() => router.push(`/(tabs)/cases?status=${item.key}` as any)}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.statusLabel, { color: colors.text }]}>{item.label}</Text>
                </View>
                <Text style={[styles.statusValue, { color: colors.text }]}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.secondary }]} onPress={() => router.push("/report") }>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Add incident</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/(tabs)/cases") }>
            <Feather name="list" size={18} color={colors.text} />
            <Text style={[styles.quickActionAltText, { color: colors.text }]}>View cases</Text>
          </TouchableOpacity>
        </View>

        {myReports.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MY RECENT REPORTS</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>All cases</Text>
              </TouchableOpacity>
            </View>
            {myReports.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT INCIDENTS</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary, bottom: insets.bottom + 108 }]}
        onPress={() => router.push("/report")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  hero: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  kicker: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 18 },
  heroBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  quickAction: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  quickActionText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  quickActionAlt: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1 },
  quickActionAltText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  section: { marginTop: 14 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionLink: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chartCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  chartTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 12 },
  severityList: { gap: 12 },
  severityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  severityLeft: { width: 78, flexDirection: "row", alignItems: "center", gap: 8 },
  severityBarTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" },
  severityBarFill: { height: "100%", borderRadius: 999 },
  severityValue: { width: 22, textAlign: "right", fontSize: 14, fontFamily: "Inter_700Bold" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});