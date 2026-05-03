import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";

const { width } = Dimensions.get("window");
const BAR_MAX_WIDTH = width - 80;

function HorizontalBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const colors = useColors();
  const pct = max > 0 ? (value / max) * 100 : 0;
  const barWidth = (BAR_MAX_WIDTH * pct) / 100;
  return (
    <View style={barStyles.row}>
      <Text style={[barStyles.label, { color: colors.text }]} numberOfLines={1}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.value, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  label: { width: 70, fontSize: 12, fontFamily: "Inter_500Medium" },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#EDF0F3", overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  value: { width: 28, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" },
});

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { incidents } = useIncidents();
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [query, setQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState<"all" | "7" | "30" | "90">("all");

  const filteredIncidents = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      rangeFilter === "7" ? 7 * 86400000 : rangeFilter === "30" ? 30 * 86400000 : rangeFilter === "90" ? 90 * 86400000 : 0;
    return incidents.filter((inc) => {
      const matchesType = typeFilter === "all" || inc.type === typeFilter;
      const matchesStatus = statusFilter === "all" || inc.status === statusFilter;
      const matchesQuery =
        !query.trim() ||
        [inc.title, inc.location, inc.lga, inc.state, inc.description]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase());
      const matchesRange = rangeMs === 0 || now - new Date(inc.dateTime).getTime() <= rangeMs;
      return matchesType && matchesStatus && matchesQuery && matchesRange;
    });
  }, [incidents, query, rangeFilter, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byState: Record<string, number> = {};
    const byLGA: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    filteredIncidents.forEach((inc) => {
      byType[inc.type] = (byType[inc.type] || 0) + 1;
      bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
      if (inc.state) byState[inc.state] = (byState[inc.state] || 0) + 1;
      if (inc.lga) byLGA[inc.lga] = (byLGA[inc.lga] || 0) + 1;
      byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
      const month = new Date(inc.dateTime).toLocaleDateString("en-GB", { month: "short" });
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    return { byType, bySeverity, byState, byLGA, byStatus, byMonth };
  }, [filteredIncidents]);

  const maxType = Math.max(...Object.values(stats.byType), 1);
  const maxState = Math.max(...Object.values(stats.byState), 1);
  const maxLGA = Math.max(...Object.values(stats.byLGA), 1);

  const typeColors: Record<string, string> = {
    crash: "#C0392B",
    breakdown: "#E67E22",
    hazard: "#C8960C",
    flooding: "#2C7BE5",
  };
  const severityColors: Record<string, string> = {
    fatal: "#8B0000",
    serious: "#E67E22",
    minor: "#27AE60",
    property_only: "#6B7A8A",
  };

  const totalCasualties = filteredIncidents.reduce((sum, i) => sum + i.victims.length, 0);
  const fatalVictims = incidents.reduce(
    (sum, i) => sum + i.victims.filter((v) => v.condition === "deceased").length,
    0
  );
  const seriousVictims = incidents.reduce(
    (sum, i) => sum + i.victims.filter((v) => v.condition === "critical" || v.condition === "injured").length,
    0
  );
  const hasFilters =
    typeFilter !== "all" || statusFilter !== "all" || query.trim().length > 0 || rangeFilter !== "all";

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primary,
            paddingTop: topPad + 12,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics & Hotspots</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={styles.headerSub}>
          {filteredIncidents.length} filtered incidents · Sector overview
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="FILTER INCIDENTS" colors={colors}>
          <View style={[styles.filterBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.filterHeaderRow}>
              <Text style={[styles.filterMeta, { color: colors.mutedForeground }]}>
                {hasFilters ? "Filters active" : "Showing all incidents"}
              </Text>
              {hasFilters ? (
                <TouchableOpacity
                  onPress={() => {
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setQuery("");
                    setRangeFilter("all");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.resetText, { color: colors.primary }]}>Reset</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search title, location, state..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
            />
            <View style={styles.filterRow}>
              <FilterPill label="All types" active={typeFilter === "all"} onPress={() => setTypeFilter("all")} />
              <FilterPill label="Crash" active={typeFilter === "crash"} onPress={() => setTypeFilter("crash")} />
              <FilterPill label="Breakdown" active={typeFilter === "breakdown"} onPress={() => setTypeFilter("breakdown")} />
              <FilterPill label="Hazard" active={typeFilter === "hazard"} onPress={() => setTypeFilter("hazard")} />
              <FilterPill label="Flooding" active={typeFilter === "flooding"} onPress={() => setTypeFilter("flooding")} />
            </View>
            <View style={styles.filterRow}>
              <FilterPill label="Any status" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
              <FilterPill label="Open" active={statusFilter === "open"} onPress={() => setStatusFilter("open")} />
              <FilterPill label="Submitted" active={statusFilter === "submitted"} onPress={() => setStatusFilter("submitted")} />
              <FilterPill label="Review" active={statusFilter === "under_review"} onPress={() => setStatusFilter("under_review")} />
              <FilterPill label="Closed" active={statusFilter === "closed"} onPress={() => setStatusFilter("closed")} />
            </View>
            <View style={styles.filterRow}>
              <FilterPill label="All time" active={rangeFilter === "all"} onPress={() => setRangeFilter("all")} />
              <FilterPill label="7d" active={rangeFilter === "7"} onPress={() => setRangeFilter("7")} />
              <FilterPill label="30d" active={rangeFilter === "30"} onPress={() => setRangeFilter("30")} />
              <FilterPill label="90d" active={rangeFilter === "90"} onPress={() => setRangeFilter("90")} />
            </View>
          </View>
        </Section>

        {/* Casualty summary */}
        <View style={styles.row}>
          <SummaryCard colors={colors} label="Total Incidents" value={filteredIncidents.length} icon="activity" color={colors.primary}
            onPress={() => router.push("/(tabs)/cases" as any)} />
          <View style={{ width: 10 }} />
          <SummaryCard colors={colors} label="Fatal Crashes" value={stats.bySeverity["fatal"] || 0} icon="alert-triangle" color={colors.fatal}
            onPress={() => router.push({ pathname: "/(tabs)/cases", params: { severity: "fatal" } } as any)} />
        </View>
        <View style={[styles.row, { marginTop: 10 }]}>
          <SummaryCard colors={colors} label="Pending Review" value={(stats.byStatus["submitted"] || 0) + (stats.byStatus["under_review"] || 0)} icon="clock" color={colors.warning}
            onPress={() => router.push({ pathname: "/(tabs)/cases", params: { status: "open" } } as any)} />
          <View style={{ width: 10 }} />
          <SummaryCard colors={colors} label="Closed Cases" value={stats.byStatus["closed"] || 0} icon="check-circle" color={colors.success}
            onPress={() => router.push({ pathname: "/(tabs)/cases", params: { status: "closed" } } as any)} />
        </View>

        {/* By type */}
        <Section title="BY INCIDENT TYPE" colors={colors}>
          {Object.entries(stats.byType).map(([type, count]) => (
            <HorizontalBar
              key={type}
              label={type}
              value={count}
              max={maxType}
              color={typeColors[type] || colors.mutedForeground}
            />
          ))}
        </Section>

        {/* By severity */}
        <Section title="BY SEVERITY" colors={colors}>
          <View style={styles.sevGrid}>
            {Object.entries(stats.bySeverity).map(([sev, count]) => (
              <TouchableOpacity
                key={sev}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: "/(tabs)/cases", params: { severity: sev } } as any)}
                style={[
                  styles.sevCard,
                  { borderColor: severityColors[sev] + "44", backgroundColor: severityColors[sev] + "10" },
                ]}
              >
                <Text style={[styles.sevValue, { color: severityColors[sev] }]}>{count}</Text>
                <Text style={[styles.sevLabel, { color: colors.mutedForeground }]}>
                  {sev.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* By status */}
        <Section title="CASE STATUS BREAKDOWN" colors={colors}>
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const total = filteredIncidents.length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <TouchableOpacity
                key={status}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: "/(tabs)/cases", params: { status } } as any)}
                style={styles.statusRow}
              >
                <Text style={[styles.statusLabel, { color: colors.text }]}>
                  {status.replace("_", " ")}
                </Text>
                <View style={[styles.statusTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.statusFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: status === "closed" ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.statusPct, { color: colors.mutedForeground }]}>
                  {pct}%
                </Text>
                <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </Section>

        {/* By LGA */}
          {Object.keys(stats.byLGA).length > 0 && (
          <Section title="TOP LGAs BY INCIDENT COUNT" colors={colors}>
            {Object.entries(stats.byLGA)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([lga, count], idx) => (
                <View key={lga} style={styles.hotspotRow}>
                  <View
                    style={[
                      styles.hotspotRank,
                      {
                        backgroundColor: idx === 0 ? colors.fatal : idx === 1 ? colors.warning : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.hotspotRankText,
                        { color: idx < 2 ? "#fff" : colors.mutedForeground },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <HorizontalBar
                    label={lga}
                    value={count}
                    max={maxLGA}
                    color={idx === 0 ? colors.fatal : idx === 1 ? colors.warning : colors.info}
                  />
                </View>
              ))}
          </Section>
        )}

        {/* By state */}
        <Section title="HOTSPOT AREAS BY STATE" colors={colors}>
          {Object.entries(stats.byState)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([state, count], idx) => (
              <View key={state} style={styles.hotspotRow}>
                <View
                  style={[
                    styles.hotspotRank,
                    {
                      backgroundColor: idx === 0 ? colors.fatal : idx === 1 ? colors.warning : colors.muted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hotspotRankText,
                      { color: idx < 2 ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </View>
                <HorizontalBar
                  label={state}
                  value={count}
                  max={maxState}
                  color={idx === 0 ? colors.fatal : idx === 1 ? colors.warning : colors.primary}
                />
              </View>
            ))}
        </Section>

        {/* Operational insights */}
        <Section title="OPERATIONAL INSIGHTS" colors={colors}>
          <InsightRow
            colors={colors}
            icon="clock"
            iconColor={colors.info}
            text={`Average case age: ${getAvgAge(incidents)} hours`}
          />
          <InsightRow
            colors={colors}
            icon="check-circle"
            iconColor={colors.success}
            text={`${stats.byStatus["closed"] || 0} of ${incidents.length} cases closed (${incidents.length > 0 ? Math.round(((stats.byStatus["closed"] || 0) / incidents.length) * 100) : 0}% closure rate)`}
          />
          <InsightRow
            colors={colors}
            icon="alert-triangle"
            iconColor={colors.fatal}
            text={`${stats.bySeverity["fatal"] || 0} fatal incidents requiring follow-up review`}
          />
          <InsightRow
            colors={colors}
            icon="user-check"
            iconColor={colors.warning}
            text={`${stats.byStatus["submitted"] || 0} reports awaiting assignment`}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

function SummaryCard({ colors, label, value, icon, color, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[sc.card, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}
    >
      <View style={[sc.icon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[sc.value, { color: colors.text }]}>{value}</Text>
      <Text style={[sc.label, { color: colors.mutedForeground }]}>{label}</Text>
      {onPress && (
        <View style={sc.drill}>
          <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  icon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  value: { fontSize: 24, fontFamily: "Inter_700Bold" },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  drill: { position: "absolute", top: 10, right: 10 },
});

function Section({ title, colors, children }: any) {
  return (
    <View style={[styles.section]}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function InsightRow({ colors, icon, iconColor, text }: any) {
  return (
    <View style={[styles.insightRow, { borderBottomColor: colors.border }]}>
      <Feather name={icon} size={16} color={iconColor} />
      <Text style={[styles.insightText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.filterPill,
        {
          backgroundColor: active ? colors.primary : colors.muted,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.filterPillText, { color: active ? "#fff" : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function getAvgAge(incidents: any[]) {
  if (!incidents.length) return 0;
  const open = incidents.filter((i) => i.status !== "closed");
  if (!open.length) return 0;
  const avg = open.reduce((sum, i) => sum + (Date.now() - new Date(i.dateTime).getTime()), 0) / open.length;
  return Math.round(avg / 3600000);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  sevGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sevCard: {
    flex: 1,
    minWidth: 80,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  sevValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  sevLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    textTransform: "capitalize",
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  statusLabel: {
    width: 90,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  statusTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  statusFill: {
    height: 8,
    borderRadius: 4,
  },
  statusPct: {
    width: 32,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
  hotspotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  hotspotRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotRankText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  filterBox: {
    gap: 10,
  },
  filterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterMeta: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  resetText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
