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
import { useAuth, UserRole } from "@/context/AuthContext";
import { useIncidents } from "@/context/IncidentContext";
import { usePatrol } from "@/context/PatrolContext";
import { useColors } from "@/hooks/useColors";
import { IncidentCard } from "@/components/IncidentCard";
import { MetricCard } from "@/components/MetricCard";
import { SyncBanner } from "@/components/SyncBanner";

const ROLE_LABEL: Record<UserRole, string> = {
  field_officer: "Field Officer",
  supervisor: "Supervisor",
  commander: "Operations Commander",
};

const QUICK_ACTIONS = [
  { label: "Report Crash", icon: "alert-triangle", color: "#C0392B", route: "/report" },
  { label: "Vehicle Lookup", icon: "truck", color: "#2C7BE5", route: "/vehicle-lookup" },
  { label: "Patrol Log", icon: "clipboard", color: "#1B5E3B", route: "/patrol-log" },
  { label: "View Map", icon: "map", color: "#6B7A8A", route: "/(tabs)/map" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { incidents } = useIncidents();
  const { activeSession } = usePatrol();
  const router = useRouter();

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayInc = incidents.filter(
      (i) => new Date(i.dateTime) >= today
    );
    return {
      total: incidents.length,
      today: todayInc.length,
      fatal: incidents.filter((i) => i.severity === "fatal").length,
      open: incidents.filter(
        (i) => i.status !== "closed"
      ).length,
    };
  }, [incidents]);

  const recent = useMemo(
    () => incidents.slice(0, 5),
    [incidents]
  );

  const myReports = useMemo(
    () => incidents.filter((i) => i.reportedBy === user?.id).slice(0, 3),
    [incidents, user?.id]
  );

  const greeting = getGreeting();

  function onQuickAction(route: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{user?.name}</Text>
            <View style={styles.badge}>
              <Feather name="shield" size={11} color="rgba(255,255,255,0.7)" />
              <Text style={styles.badgeText}>
                {user?.badgeNumber} · {ROLE_LABEL[user?.role || "field_officer"]}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.profileBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Feather name="user" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatPill label="Total" value={stats.total} onPress={() => router.push({ pathname: "/(tabs)/cases" } as any)} />
          <StatPill label="Today" value={stats.today} onPress={() => router.push({ pathname: "/(tabs)/cases", params: { filter: "today" } } as any)} />
          <StatPill label="Open" value={stats.open} highlight onPress={() => router.push({ pathname: "/(tabs)/cases", params: { status: "open" } } as any)} />
          <StatPill label="Fatal" value={stats.fatal} danger onPress={() => router.push({ pathname: "/(tabs)/cases", params: { severity: "fatal" } } as any)} />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <SyncBanner />

        {/* Duty status banner */}
        {activeSession && (
          <TouchableOpacity
            onPress={() => router.push("/patrol-log")}
            style={[
              styles.dutyBanner,
              {
                backgroundColor:
                  activeSession.status === "on_duty"
                    ? colors.successLight
                    : colors.warningLight,
                borderColor:
                  activeSession.status === "on_duty"
                    ? colors.success + "40"
                    : colors.warning + "40",
              },
            ]}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.dutyDot,
                {
                  backgroundColor:
                    activeSession.status === "on_duty" ? colors.success : colors.warning,
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.dutyTitle,
                  {
                    color:
                      activeSession.status === "on_duty" ? colors.success : colors.warning,
                  },
                ]}
              >
                {activeSession.status === "on_duty" ? "On Duty" : "On Break"}
              </Text>
              <Text
                style={[styles.dutySub, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {activeSession.route} · {activeSession.encounters.length} entries
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            QUICK ACTIONS
          </Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((qa) => (
              <TouchableOpacity
                key={qa.label}
                style={[styles.qaBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onQuickAction(qa.route)}
                activeOpacity={0.75}
              >
                <View style={[styles.qaIcon, { backgroundColor: qa.color + "18" }]}>
                  <Feather name={qa.icon as any} size={22} color={qa.color} />
                </View>
                <Text style={[styles.qaLabel, { color: colors.text }]}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            THIS MONTH
          </Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Incidents"
              value={incidents.length}
              icon="activity"
              color={colors.primary}
              bgColor={colors.successLight}
            />
            <View style={{ width: 10 }} />
            <MetricCard
              label="Fatal Crashes"
              value={stats.fatal}
              icon="alert-triangle"
              color={colors.fatal}
              bgColor={colors.fatalLight}
            />
          </View>
          <View style={[styles.metricsRow, { marginTop: 10 }]}>
            <MetricCard
              label="Pending Review"
              value={stats.open}
              icon="clock"
              color={colors.warning}
              bgColor={colors.warningLight}
            />
            <View style={{ width: 10 }} />
            <MetricCard
              label="Closed Cases"
              value={incidents.filter((i) => i.status === "closed").length}
              icon="check-circle"
              color={colors.success}
              bgColor={colors.successLight}
            />
          </View>
        </View>

        {/* Analytics shortcut (supervisor/commander) */}
        {(user?.role === "supervisor" || user?.role === "commander") && (
          <TouchableOpacity
            style={[styles.analyticsCard, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/analytics")}
            activeOpacity={0.85}
          >
            <Feather name="bar-chart-2" size={22} color="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.analyticsTitle}>Analytics & Hotspots</Text>
              <Text style={styles.analyticsSub}>
                View crash density, trends and sector summary
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* My recent reports (field officers) */}
        {myReports.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                MY RECENT REPORTS
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>All cases</Text>
              </TouchableOpacity>
            </View>
            {myReports.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </View>
        )}

        {/* Recent incidents */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              RECENT INCIDENTS
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary, bottom: bottomPad - 30 }]}
        onPress={() => onQuickAction("/report")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function StatPill({
  label, value, highlight, danger, onPress,
}: {
  label: string; value: number; highlight?: boolean; danger?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        pillStyles.pill,
        danger && { backgroundColor: "rgba(192,57,43,0.3)" },
        highlight && { backgroundColor: "rgba(255,255,255,0.2)" },
        onPress && pillStyles.pillTappable,
      ]}
    >
      <Text style={pillStyles.value}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 8,
    minWidth: 70,
  },
  pillTappable: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },
});

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    paddingHorizontal: 18,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  qaBtn: {
    width: "47%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  qaIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qaLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  metricsRow: {
    flexDirection: "row",
  },
  analyticsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
  },
  analyticsTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  analyticsSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  dutyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dutyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dutyTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dutySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});
