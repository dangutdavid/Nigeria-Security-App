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

const TREND_HEIGHT = 80;

function WeeklyTrend({
  incidents,
  colors,
}: {
  incidents: ReturnType<typeof useIncidents>["incidents"];
  colors: ReturnType<typeof useColors>;
}) {
  const days = useMemo(() => {
    const result: Array<{ label: string; shortDate: string; count: number; fatal: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayIncs = incidents.filter((inc) => new Date(inc.dateTime).toDateString() === dayStr);
      result.push({
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        shortDate: d.toLocaleDateString("en-GB", { day: "numeric", month: "numeric" }),
        count: dayIncs.length,
        fatal: dayIncs.filter((inc) => inc.severity === "fatal").length,
        isToday: i === 0,
      });
    }
    return result;
  }, [incidents]);

  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const totalWeek = days.reduce((s, d) => s + d.count, 0);
  const fatalWeek = days.reduce((s, d) => s + d.fatal, 0);
  const peakDay = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);

  return (
    <View>
      <View style={trendStyles.metaRow}>
        <View style={trendStyles.metaItem}>
          <Text style={[trendStyles.metaValue, { color: colors.text }]}>{totalWeek}</Text>
          <Text style={[trendStyles.metaLabel, { color: colors.mutedForeground }]}>this week</Text>
        </View>
        {fatalWeek > 0 && (
          <View style={trendStyles.metaItem}>
            <Text style={[trendStyles.metaValue, { color: colors.fatal }]}>{fatalWeek}</Text>
            <Text style={[trendStyles.metaLabel, { color: colors.mutedForeground }]}>fatal</Text>
          </View>
        )}
        {peakDay.count > 0 && (
          <View style={trendStyles.metaItem}>
            <Text style={[trendStyles.metaValue, { color: colors.text }]}>{peakDay.count}</Text>
            <Text style={[trendStyles.metaLabel, { color: colors.mutedForeground }]}>peak day</Text>
          </View>
        )}
      </View>

      <View style={trendStyles.chart}>
        {days.map((day, idx) => {
          const barH = Math.round((day.count / maxCount) * TREND_HEIGHT);
          return (
            <View key={idx} style={trendStyles.col}>
              {day.count > 0 ? (
                <Text style={[trendStyles.countLabel, { color: day.isToday ? colors.primary : colors.mutedForeground }]}>
                  {day.count}
                </Text>
              ) : (
                <Text style={trendStyles.countLabel}>{" "}</Text>
              )}
              <View style={[trendStyles.barTrack, { height: TREND_HEIGHT }]}>
                {day.fatal > 0 && (
                  <View
                    style={[
                      trendStyles.barSegment,
                      {
                        height: Math.round((day.fatal / maxCount) * TREND_HEIGHT),
                        backgroundColor: colors.fatal,
                        opacity: 0.9,
                      },
                    ]}
                  />
                )}
                {day.count - day.fatal > 0 && (
                  <View
                    style={[
                      trendStyles.barSegment,
                      {
                        height: Math.round(((day.count - day.fatal) / maxCount) * TREND_HEIGHT),
                        backgroundColor: day.isToday ? colors.primary : colors.secondary,
                        opacity: day.isToday ? 1 : 0.6,
                      },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  trendStyles.dayLabel,
                  {
                    color: day.isToday ? colors.primary : colors.mutedForeground,
                    fontFamily: day.isToday ? "Inter_700Bold" : "Inter_400Regular",
                  },
                ]}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>

      {fatalWeek > 0 && (
        <View style={trendStyles.legend}>
          <View style={[trendStyles.legendDot, { backgroundColor: colors.fatal }]} />
          <Text style={[trendStyles.legendText, { color: colors.mutedForeground }]}>Fatal</Text>
          <View style={[trendStyles.legendDot, { backgroundColor: colors.secondary, marginLeft: 10 }]} />
          <Text style={[trendStyles.legendText, { color: colors.mutedForeground }]}>Other</Text>
        </View>
      )}
    </View>
  );
}

const trendStyles = StyleSheet.create({
  metaRow: { flexDirection: "row", gap: 24, marginBottom: 14 },
  metaItem: { alignItems: "center" },
  metaValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metaLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  col: { flex: 1, alignItems: "center", gap: 4 },
  countLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", height: 14, lineHeight: 14 },
  barTrack: { width: "100%", justifyContent: "flex-end", borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.04)" },
  barSegment: { width: "100%", borderRadius: 0 },
  dayLabel: { fontSize: 11, marginTop: 2 },
  legend: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_500Medium" },
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

  // Peak hour of day
  const peakHour = useMemo(() => {
    const hourCounts: number[] = Array(24).fill(0);
    for (const inc of incidents) {
      const h = new Date(inc.dateTime).getHours();
      hourCounts[h]++;
    }
    const maxCount = Math.max(...hourCounts);
    if (maxCount === 0) return null;
    const hour = hourCounts.indexOf(maxCount);
    const label = hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
    return { hour, label, count: maxCount };
  }, [incidents]);

  // Most common incident type
  const topType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inc of incidents) counts[inc.type] = (counts[inc.type] || 0) + 1;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    const [type, count] = entries[0];
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const pct = incidents.length > 0 ? Math.round((count / incidents.length) * 100) : 0;
    return { type, label, count, pct };
  }, [incidents]);

  // Busiest day of week
  const peakDay = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const inc of incidents) dayCounts[new Date(inc.dateTime).getDay()]++;
    const maxCount = Math.max(...dayCounts);
    if (maxCount === 0) return null;
    const dayIdx = dayCounts.indexOf(maxCount);
    const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { label: labels[dayIdx], count: maxCount };
  }, [incidents]);

  // Most active officer (by report count)
  const topOfficer = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const inc of incidents) {
      if (!inc.reportedBy || !inc.reportedByName) continue;
      if (!counts[inc.reportedBy]) counts[inc.reportedBy] = { name: inc.reportedByName, count: 0 };
      counts[inc.reportedBy].count++;
    }
    const entries = Object.values(counts).sort((a, b) => b.count - a.count);
    return entries.length > 0 ? entries[0] : null;
  }, [incidents]);

  // Week-over-week comparison
  const weekComparison = useMemo(() => {
    const now = Date.now();
    const thisWeekStart = now - 7 * 86400000;
    const lastWeekStart = now - 14 * 86400000;
    const thisWeek = incidents.filter((i) => new Date(i.dateTime).getTime() >= thisWeekStart).length;
    const lastWeek = incidents.filter((i) => {
      const t = new Date(i.dateTime).getTime();
      return t >= lastWeekStart && t < thisWeekStart;
    }).length;
    const diff = thisWeek - lastWeek;
    const pct = lastWeek > 0 ? Math.abs(Math.round((diff / lastWeek) * 100)) : null;
    return { thisWeek, lastWeek, diff, pct };
  }, [incidents]);

  // Average resolution time (submitted → closed)
  const avgResolutionHours = useMemo(() => {
    const closed = incidents.filter((i) => i.status === "closed" && i.timeline.length > 1);
    if (closed.length === 0) return null;
    let total = 0;
    for (const inc of closed) {
      const submitted = inc.timeline.find((t) => t.action.includes("submitted") || t.action.includes("Incident reported"));
      const closedEntry = [...inc.timeline].reverse().find((t) => t.action.toLowerCase().includes("closed"));
      if (submitted && closedEntry) {
        const diff = new Date(closedEntry.timestamp).getTime() - new Date(submitted.timestamp).getTime();
        total += diff / 3600000;
      }
    }
    return Math.round(total / closed.length);
  }, [incidents]);

  const totalCasualties = filteredIncidents.reduce((sum, i) => sum + i.victims.length, 0);
  const fatalVictims = incidents.reduce(
    (sum, i) => sum + i.victims.filter((v) => v.condition === "fatal").length,
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
            {hasFilters ? (
              <View style={styles.activeFiltersRow}>
                {typeFilter !== "all" ? <FilterPill label={typeFilter} active onPress={() => setTypeFilter("all")} /> : null}
                {statusFilter !== "all" ? <FilterPill label={statusFilter.replace("_", " ")} active onPress={() => setStatusFilter("all")} /> : null}
                {rangeFilter !== "all" ? <FilterPill label={`${rangeFilter}d`} active onPress={() => setRangeFilter("all")} /> : null}
                {query.trim() ? <FilterPill label={`“${query.trim()}”`} active onPress={() => setQuery("")} /> : null}
              </View>
            ) : null}
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

        {/* Closure rate + casualty strip */}
        {filteredIncidents.length > 0 && (() => {
          const closed = stats.byStatus["closed"] || 0;
          const closureRate = Math.round((closed / filteredIncidents.length) * 100);
          const totalVehicles = filteredIncidents.reduce((s, i) => s + i.vehicles.length, 0);
          return (
            <View style={[styles.closureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.closureLeft}>
                <View style={[styles.closureArcWrap, { borderColor: closureRate >= 60 ? colors.success : closureRate >= 30 ? colors.warning : colors.fatal }]}>
                  <Text style={[styles.closureRatePct, { color: closureRate >= 60 ? colors.success : closureRate >= 30 ? colors.warning : colors.fatal }]}>
                    {closureRate}%
                  </Text>
                  <Text style={[styles.closureRateLabel, { color: colors.mutedForeground }]}>closed</Text>
                </View>
              </View>
              <View style={[styles.closureDivider, { backgroundColor: colors.border }]} />
              <View style={styles.closureRight}>
                <View style={styles.closureMetric}>
                  <Text style={[styles.closureMetricVal, { color: colors.text }]}>{totalCasualties}</Text>
                  <Text style={[styles.closureMetricLabel, { color: colors.mutedForeground }]}>casualties</Text>
                </View>
                <View style={[styles.closureMetricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.closureMetric}>
                  <Text style={[styles.closureMetricVal, { color: colors.text }]}>{fatalVictims}</Text>
                  <Text style={[styles.closureMetricLabel, { color: colors.fatal }]}>fatal</Text>
                </View>
                <View style={[styles.closureMetricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.closureMetric}>
                  <Text style={[styles.closureMetricVal, { color: colors.text }]}>{totalVehicles}</Text>
                  <Text style={[styles.closureMetricLabel, { color: colors.mutedForeground }]}>vehicles</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* 7-day trend */}
        <Section title="7-DAY TREND" colors={colors}>
          <WeeklyTrend incidents={filteredIncidents} colors={colors} />
        </Section>

        {/* By type */}
        <Section title="BY INCIDENT TYPE" colors={colors}>
          {Object.entries(stats.byType).map(([type, count]) => {
            const pct = filteredIncidents.length > 0 ? Math.round((count / filteredIncidents.length) * 100) : 0;
            return (
              <View key={type} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <HorizontalBar label={type} value={count} max={maxType} color={typeColors[type] || colors.mutedForeground} />
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginLeft: 4, width: 32, textAlign: "right" }}>{pct}%</Text>
                </View>
              </View>
            );
          })}
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

        {/* Monthly breakdown */}
        {Object.keys(stats.byMonth).length > 1 && (
          <Section title="MONTHLY ACTIVITY" colors={colors}>
            {(() => {
              const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const entries = Object.entries(stats.byMonth).sort(
                (a, b) => MONTH_ORDER.indexOf(a[0]) - MONTH_ORDER.indexOf(b[0])
              );
              const maxMonthly = Math.max(...entries.map(([, v]) => v), 1);
              return entries.map(([month, count]) => (
                <HorizontalBar key={month} label={month} value={count} max={maxMonthly} color={colors.primary} />
              ));
            })()}
          </Section>
        )}

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
          {avgResolutionHours !== null && (
            <InsightRow
              colors={colors}
              icon="watch"
              iconColor={colors.info}
              text={`Average resolution time: ${avgResolutionHours < 24 ? `${avgResolutionHours}h` : `${Math.round(avgResolutionHours / 24)}d`} from report to close`}
            />
          )}
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
          <InsightRow
            colors={colors}
            icon={weekComparison.diff > 0 ? "trending-up" : weekComparison.diff < 0 ? "trending-down" : "minus"}
            iconColor={weekComparison.diff > 0 ? colors.fatal : weekComparison.diff < 0 ? colors.success : colors.mutedForeground}
            text={
              weekComparison.diff === 0
                ? `This week: ${weekComparison.thisWeek} incidents — same as last week`
                : weekComparison.pct !== null
                ? `This week: ${weekComparison.thisWeek} incidents (${weekComparison.diff > 0 ? "+" : ""}${weekComparison.pct}% vs last week's ${weekComparison.lastWeek})`
                : `This week: ${weekComparison.thisWeek} incidents vs last week: ${weekComparison.lastWeek}`
            }
          />
          {peakHour !== null && (
            <InsightRow
              colors={colors}
              icon="sun"
              iconColor={colors.warning}
              text={`Peak incident hour: ${peakHour.label} (${peakHour.count} incident${peakHour.count !== 1 ? "s" : ""} recorded at that hour)`}
            />
          )}
          {topType !== null && (
            <InsightRow
              colors={colors}
              icon="pie-chart"
              iconColor={typeColors[topType.type] ?? colors.primary}
              text={`Most common type: ${topType.label} — ${topType.pct}% of all incidents (${topType.count} cases)`}
            />
          )}
          {filteredIncidents.length > 0 && (() => {
            const crashCount = stats.byType["crash"] || 0;
            const crashPct = Math.round((crashCount / filteredIncidents.length) * 100);
            return (
              <InsightRow
                colors={colors}
                icon="alert-triangle"
                iconColor="#C0392B"
                text={`Crash incidents: ${crashCount} (${crashPct}% of all reports) — leading incident category`}
              />
            );
          })()}
          {peakHour && (
            <InsightRow
              colors={colors}
              icon="sun"
              iconColor={colors.warning}
              text={`Peak reporting hour: ${peakHour.label} (${peakHour.count} incident${peakHour.count !== 1 ? "s" : ""} — highest single-hour volume)`}
            />
          )}
          {topType && (
            <InsightRow
              colors={colors}
              icon="pie-chart"
              iconColor={colors.primary}
              text={`Most common type: ${topType.label} (${topType.count} incidents, ${topType.pct}% of all cases)`}
            />
          )}
          {topOfficer && (
            <InsightRow
              colors={colors}
              icon="award"
              iconColor="#9B59B6"
              text={`Most active officer: ${topOfficer.name} (${topOfficer.count} report${topOfficer.count !== 1 ? "s" : ""} filed)`}
            />
          )}
          {peakDay && (
            <InsightRow
              colors={colors}
              icon="calendar"
              iconColor="#16A085"
              text={`Busiest day: ${peakDay.label} (${peakDay.count} incident${peakDay.count !== 1 ? "s" : ""} — most reports on this day of the week)`}
            />
          )}
        </Section>

        {/* Officer activity */}
        <OfficerActivity incidents={filteredIncidents} colors={colors} onPress={(name) => setQuery(name)} />

      </ScrollView>
    </View>
  );
}

function OfficerActivity({
  incidents,
  colors,
  onPress,
}: {
  incidents: ReturnType<typeof useIncidents>["incidents"];
  colors: ReturnType<typeof useColors>;
  onPress: (name: string) => void;
}) {
  const officers = useMemo(() => {
    const map: Record<string, { name: string; reported: number; assigned: number; closed: number }> = {};
    incidents.forEach((inc) => {
      if (inc.reportedByName) {
        if (!map[inc.reportedBy]) map[inc.reportedBy] = { name: inc.reportedByName, reported: 0, assigned: 0, closed: 0 };
        map[inc.reportedBy].reported += 1;
        if (inc.status === "closed") map[inc.reportedBy].closed += 1;
      }
      if (inc.assignedTo && inc.assignedToName) {
        if (!map[inc.assignedTo]) map[inc.assignedTo] = { name: inc.assignedToName, reported: 0, assigned: 0, closed: 0 };
        map[inc.assignedTo].assigned += 1;
      }
    });
    return Object.entries(map)
      .map(([id, v]) => ({ id, ...v, total: v.reported + v.assigned }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [incidents]);

  if (officers.length === 0) return null;

  return (
    <Section title="OFFICER ACTIVITY" colors={colors}>
      {officers.map((officer, idx) => {
        const closureRate = officer.reported > 0 ? Math.round((officer.closed / officer.reported) * 100) : null;
        return (
          <TouchableOpacity
            key={officer.id}
            style={[officerStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => onPress(officer.name)}
            activeOpacity={0.75}
          >
            <View style={[officerStyles.rank, { backgroundColor: idx === 0 ? colors.primary + "18" : colors.muted }]}>
              <Text style={[officerStyles.rankText, { color: idx === 0 ? colors.primary : colors.mutedForeground }]}>
                {idx + 1}
              </Text>
            </View>
            <View style={officerStyles.body}>
              <Text style={[officerStyles.name, { color: colors.text }]} numberOfLines={1}>
                {officer.name}
              </Text>
              <Text style={[officerStyles.meta, { color: colors.mutedForeground }]}>
                {officer.reported} filed · {officer.assigned} assigned
                {closureRate !== null ? ` · ${closureRate}% closed` : ""}
              </Text>
            </View>
            <View style={officerStyles.badge}>
              <Text style={[officerStyles.badgeNum, { color: colors.primary }]}>{officer.total}</Text>
              <Text style={[officerStyles.badgeLabel, { color: colors.mutedForeground }]}>cases</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </Section>
  );
}

const officerStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  rank: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  body: { flex: 1 },
  name: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { alignItems: "center" },
  badgeNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  badgeLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

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
  activeFiltersRow: {
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
  closureCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  closureLeft: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  closureArcWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  closureRatePct: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  closureRateLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  closureDivider: {
    width: 1,
    marginVertical: 16,
  },
  closureRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  closureMetric: {
    alignItems: "center",
    gap: 4,
  },
  closureMetricVal: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  closureMetricLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  closureMetricDivider: {
    width: 1,
    height: 30,
  },
});
