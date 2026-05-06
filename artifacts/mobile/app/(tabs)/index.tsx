import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";
import { usePatrol } from "@/context/PatrolContext";
import { useAuth } from "@/context/AuthContext";
import { IncidentCard } from "@/components/IncidentCard";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { incidents } = useIncidents();
  const { isOnDuty, activeSession } = usePatrol();
  const { user } = useAuth();

  const myReports = incidents.filter((incident) => incident.reportedBy === user?.id);
  const recent = incidents.slice(0, 5);
  const openCount = incidents.filter((incident) => incident.status !== "closed").length;
  const fatalCount = incidents.filter((incident) => incident.severity === "fatal" && incident.status !== "closed").length;
  const severityFilters = [
    { key: "fatal", label: "Fatal", value: incidents.filter((incident) => incident.severity === "fatal").length, color: "#8B0000" },
    { key: "serious", label: "Serious", value: incidents.filter((incident) => incident.severity === "serious").length, color: "#E67E22" },
    { key: "minor", label: "Minor", value: incidents.filter((incident) => incident.severity === "minor").length, color: "#27AE60" },
  ];
  const statusFilters = [
    { key: "submitted", label: "Submitted", value: incidents.filter((incident) => incident.status === "submitted").length, color: colors.primary },
    { key: "assigned", label: "Assigned", value: incidents.filter((incident) => incident.status === "assigned").length, color: colors.secondary },
    { key: "under_review", label: "Review", value: incidents.filter((incident) => incident.status === "under_review").length, color: colors.warning },
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
            <TouchableOpacity style={styles.heroBadge} onPress={() => router.push("/patrol-log")}>
              <Feather name={isOnDuty ? "check-circle" : "shield"} size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.dutyPill} onPress={() => router.push("/patrol-log")}>
            <View style={[styles.dutyDot, { backgroundColor: isOnDuty ? colors.success : colors.warning }]} />
            <View style={styles.dutyTextWrap}>
              <Text style={[styles.dutyText, { color: isOnDuty ? "#fff" : "#163A2A" }]}>
                {isOnDuty ? "On duty" : "Start duty"}
              </Text>
              <Text style={[styles.dutySub, { color: isOnDuty ? "rgba(255,255,255,0.85)" : "#163A2A" }]}>
                {activeSession ? activeSession.route : "Tap to start duty"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={isOnDuty ? "#fff" : "#163A2A"} />
          </TouchableOpacity>
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
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>THIS MONTH</Text>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>Tap to open cases</Text>
          </View>
          <View style={styles.monthGrid}>
            <TouchableOpacity
              style={[
                styles.monthCardLarge,
                {
                  backgroundColor: colors.secondary + "10",
                  borderColor: colors.secondary + "55",
                },
              ]}
              onPress={() => router.push("/report")}
              activeOpacity={0.85}
            >
              <View style={styles.monthCardHeader}>
                <View style={[styles.monthIconLarge, { backgroundColor: colors.secondary + "20" }]}>
                  <Feather name="plus" size={22} color={colors.secondary} />
                </View>
                <Text style={[styles.monthValueLarge, { color: colors.text }]}>{incidents.length}</Text>
              </View>
              <Text style={[styles.monthLabelLarge, { color: colors.secondary }]}>Add incident</Text>
            </TouchableOpacity>

            <View style={styles.monthSplitRow}>
              <TouchableOpacity
                style={[styles.monthCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/cases?severity=fatal" as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.monthIconSmall, { backgroundColor: colors.fatalLight }]}>
                  <Feather name="alert-triangle" size={18} color={colors.fatal} />
                </View>
                <View style={styles.monthCopy}>
                  <Text style={[styles.monthValueSmall, { color: colors.text }]}>{fatalCount}</Text>
                  <Text style={[styles.monthLabelSmall, { color: colors.mutedForeground }]}>Fatal Crashes</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.monthCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/cases?status=closed" as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.monthIconSmall, { backgroundColor: colors.successLight }]}>
                  <Feather name="check-circle" size={18} color={colors.success} />
                </View>
                <View style={styles.monthCopy}>
                  <Text style={[styles.monthValueSmall, { color: colors.text }]}>{incidents.filter((incident) => incident.status === "closed").length}</Text>
                  <Text style={[styles.monthLabelSmall, { color: colors.mutedForeground }]}>Closed Cases</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.monthCardWide, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/cases?status=under_review" as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.monthIconSmall, { backgroundColor: colors.warningLight }]}>
                <Feather name="clock" size={18} color={colors.warning} />
              </View>
              <View style={styles.monthCopy}>
                <Text style={[styles.monthValueSmall, { color: colors.text }]}>
                  {incidents.filter((incident) => incident.status === "submitted" || incident.status === "under_review").length}
                </Text>
                <Text style={[styles.monthLabelSmall, { color: colors.mutedForeground }]}>Pending Review</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK FILTERS</Text>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>Tap to open cases</Text>
          </View>
          <View style={styles.filterChipRow}>
            {severityFilters.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, { borderColor: item.color, backgroundColor: colors.card }]}
                onPress={() => router.push(`/(tabs)/cases?severity=${item.key}` as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.filterDot, { backgroundColor: item.color }]} />
                <Text style={[styles.filterChipText, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.filterChipCount, { color: colors.mutedForeground }]}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.statusPillsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {statusFilters.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.statusPillRow}
                onPress={() => router.push(`/(tabs)/cases?status=${item.key}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.statusLabel, { color: colors.text }]}>{item.label}</Text>
                </View>
                <Text style={[styles.statusValue, { color: colors.mutedForeground }]}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/(tabs)/cases")}>
            <Feather name="list" size={18} color={colors.text} />
            <Text style={[styles.quickActionAltText, { color: colors.text }]}>View cases</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.secondary }]} onPress={() => router.push("/report")}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Add incident</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.primary, backgroundColor: colors.primary + "14" }]} onPress={() => router.push("/analytics")}>
            <Feather name="bar-chart-2" size={18} color={colors.primary} />
            <Text style={[styles.quickActionAltText, { color: colors.primary }]}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/patrol-log")}>
            <Feather name="anchor" size={18} color={colors.text} />
            <Text style={[styles.quickActionAltText, { color: colors.text }]}>Patrol Log</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/analytics")}
            activeOpacity={0.85}
          >
            <View style={[styles.analyticsIcon, { backgroundColor: colors.primary + "14" }]}>
              <Feather name="bar-chart-2" size={18} color={colors.primary} />
            </View>
            <View style={styles.analyticsCopy}>
              <Text style={[styles.analyticsTitle, { color: colors.text }]}>Analytics & Hotspots</Text>
              <Text style={[styles.analyticsSub, { color: colors.mutedForeground }]}>
                View trends, crash patterns, and operational insights
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
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
  dutyPill: { marginTop: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.14)", flexDirection: "row", alignItems: "center", gap: 10 },
  dutyDot: { width: 10, height: 10, borderRadius: 5 },
  dutyTextWrap: { flex: 1 },
  dutyText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  dutySub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  quickAction: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  quickActionText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  quickActionAlt: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1 },
  quickActionAltText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  analyticsCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  analyticsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  analyticsCopy: { flex: 1 },
  analyticsTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  analyticsSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  section: { marginTop: 14 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionLink: { fontSize: 11, fontFamily: "Inter_500Medium" },
  monthGrid: { gap: 10 },
  monthCardLarge: { borderWidth: 1, borderRadius: 20, padding: 16 },
  monthCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthIconLarge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  monthValueLarge: { fontSize: 30, fontFamily: "Inter_700Bold" },
  monthLabelLarge: { marginTop: 12, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  monthSplitRow: { flexDirection: "row", gap: 10 },
  monthCardSmall: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  monthCardWide: { borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  monthIconSmall: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  monthCopy: { flex: 1 },
  monthValueSmall: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 20 },
  monthLabelSmall: { marginTop: 2, fontSize: 11, fontFamily: "Inter_500Medium" },
  filterChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  filterChipCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusPillsCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" },
  statusPillRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(0,0,0,0.18)" },
});