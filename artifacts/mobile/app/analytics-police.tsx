import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCrimeReports } from "@/context/CrimeReportContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#1A3A6C";
const { width } = Dimensions.get("window");
const BAR_MAX_WIDTH = width - 120;
const TREND_HEIGHT = 80;

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#8B0000",
  serious: "#C0392B",
  moderate: "#E67E22",
  minor: "#27AE60",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#C0392B",
  investigating: "#E67E22",
  arrested: "#2C7BE5",
  closed: "#27AE60",
};

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function HorizontalBar({ value, max, color, label, colors }: { value: number; max: number; color: string; label: string; colors: ReturnType<typeof useColors> }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.barFill, { width: (BAR_MAX_WIDTH * pct) / 100, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

function SummaryCard({ label, value, icon, color, colors, onPress }: { label: string; value: number; icon: keyof typeof Feather.glyphMap; color: string; colors: ReturnType<typeof useColors>; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={onPress ? 0.8 : 1} disabled={!onPress}>
      <View style={[styles.summaryIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PoliceAnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reports } = useCrimeReports();

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byState: Record<string, number> = {};
    let suspectsTotal = 0;
    let suspectsAtLarge = 0;
    let suspectsArrested = 0;
    reports.forEach((r) => {
      byType[r.crimeType] = (byType[r.crimeType] || 0) + 1;
      bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.state) byState[r.state] = (byState[r.state] || 0) + 1;
      r.suspects.forEach((s) => {
        suspectsTotal++;
        if (s.status === "at_large") suspectsAtLarge++;
        if (s.status === "arrested") suspectsArrested++;
      });
    });
    return { byType, bySeverity, byStatus, byState, suspectsTotal, suspectsAtLarge, suspectsArrested };
  }, [reports]);

  const days = useMemo(() => {
    const result: Array<{ label: string; count: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      result.push({
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        count: reports.filter((r) => new Date(r.reportedAt).toDateString() === dayStr).length,
        isToday: i === 0,
      });
    }
    return result;
  }, [reports]);
  const maxDay = Math.max(...days.map((d) => d.count), 1);
  const weekTotal = days.reduce((s, d) => s + d.count, 0);

  const maxType = Math.max(...Object.values(stats.byType), 1);
  const topStates = Object.entries(stats.byState).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxState = Math.max(...topStates.map(([, c]) => c), 1);

  const topOfficer = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    reports.forEach((r) => {
      if (!r.reportedBy) return;
      if (!counts[r.reportedBy]) counts[r.reportedBy] = { name: r.reportedByName, count: 0 };
      counts[r.reportedBy].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count)[0] ?? null;
  }, [reports]);

  const open = (stats.byStatus["open"] || 0) + (stats.byStatus["investigating"] || 0);
  const clearanceRate = reports.length > 0 ? Math.round((((stats.byStatus["arrested"] || 0) + (stats.byStatus["closed"] || 0)) / reports.length) * 100) : 0;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: PRIMARY, paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crime Analytics</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={styles.headerSub}>{reports.length} reports · Command overview</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <SummaryCard colors={colors} label="Total Reports" value={reports.length} icon="file-text" color={PRIMARY} />
          <View style={{ width: 10 }} />
          <SummaryCard colors={colors} label="Open / Active" value={open} icon="alert-circle" color="#E67E22" />
        </View>
        <View style={[styles.summaryRow, { marginTop: 10 }]}>
          <SummaryCard colors={colors} label="Arrests Made" value={stats.byStatus["arrested"] || 0} icon="user-check" color="#2C7BE5" />
          <View style={{ width: 10 }} />
          <SummaryCard colors={colors} label="Closed Cases" value={stats.byStatus["closed"] || 0} icon="check-circle" color="#27AE60" />
        </View>

        {reports.length > 0 && (
          <View style={[styles.clearanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.clearanceArc, { borderColor: clearanceRate >= 60 ? "#27AE60" : clearanceRate >= 30 ? "#E67E22" : "#C0392B" }]}>
              <Text style={[styles.clearancePct, { color: clearanceRate >= 60 ? "#27AE60" : clearanceRate >= 30 ? "#E67E22" : "#C0392B" }]}>{clearanceRate}%</Text>
              <Text style={[styles.clearanceSub, { color: colors.mutedForeground }]}>cleared</Text>
            </View>
            <View style={[styles.clearanceDivider, { backgroundColor: colors.border }]} />
            <View style={styles.clearanceRight}>
              <View style={styles.clearanceMetric}>
                <Text style={[styles.clearanceVal, { color: colors.text }]}>{stats.suspectsTotal}</Text>
                <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>suspects</Text>
              </View>
              <View style={[styles.clearanceMetricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.clearanceMetric}>
                <Text style={[styles.clearanceVal, { color: "#C0392B" }]}>{stats.suspectsAtLarge}</Text>
                <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>at large</Text>
              </View>
              <View style={[styles.clearanceMetricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.clearanceMetric}>
                <Text style={[styles.clearanceVal, { color: "#2C7BE5" }]}>{stats.suspectsArrested}</Text>
                <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>arrested</Text>
              </View>
            </View>
          </View>
        )}

        <Section title="7-DAY TREND" colors={colors}>
          <Text style={[styles.trendMeta, { color: colors.mutedForeground }]}>{weekTotal} reports this week</Text>
          <View style={styles.trendChart}>
            {days.map((day, idx) => (
              <View key={idx} style={styles.trendCol}>
                <Text style={[styles.trendCount, { color: day.isToday ? PRIMARY : colors.mutedForeground }]}>{day.count > 0 ? day.count : " "}</Text>
                <View style={[styles.trendBarTrack, { height: TREND_HEIGHT, backgroundColor: colors.muted }]}>
                  <View style={{ width: "100%", height: Math.round((day.count / maxDay) * TREND_HEIGHT), backgroundColor: day.isToday ? PRIMARY : colors.secondary, opacity: day.isToday ? 1 : 0.6, borderRadius: 6 }} />
                </View>
                <Text style={[styles.trendDay, { color: day.isToday ? PRIMARY : colors.mutedForeground }]}>{day.label}</Text>
              </View>
            ))}
          </View>
        </Section>

        {Object.keys(stats.byType).length > 0 && (
          <Section title="BY CRIME TYPE" colors={colors}>
            {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <HorizontalBar key={type} colors={colors} label={titleCase(type)} value={count} max={maxType} color={PRIMARY} />
            ))}
          </Section>
        )}

        {Object.keys(stats.bySeverity).length > 0 && (
          <Section title="BY SEVERITY" colors={colors}>
            <View style={styles.sevGrid}>
              {Object.entries(stats.bySeverity).map(([sev, count]) => (
                <View key={sev} style={[styles.sevCard, { backgroundColor: (SEVERITY_COLORS[sev] || PRIMARY) + "14", borderColor: (SEVERITY_COLORS[sev] || PRIMARY) + "30" }]}>
                  <Text style={[styles.sevValue, { color: SEVERITY_COLORS[sev] || colors.text }]}>{count}</Text>
                  <Text style={[styles.sevLabel, { color: colors.mutedForeground }]}>{titleCase(sev)}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {Object.keys(stats.byStatus).length > 0 && (
          <Section title="BY STATUS" colors={colors}>
            {(["open", "investigating", "arrested", "closed"] as const).filter((s) => stats.byStatus[s]).map((status) => {
              const count = stats.byStatus[status] || 0;
              const pct = reports.length > 0 ? Math.round((count / reports.length) * 100) : 0;
              return (
                <View key={status} style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: colors.text }]}>{titleCase(status)}</Text>
                  <View style={[styles.statusTrack, { backgroundColor: colors.muted }]}>
                    <View style={{ height: 8, width: `${pct}%`, borderRadius: 4, backgroundColor: STATUS_COLORS[status] }} />
                  </View>
                  <Text style={[styles.statusPct, { color: colors.mutedForeground }]}>{count}</Text>
                </View>
              );
            })}
          </Section>
        )}

        {topStates.length > 0 && (
          <Section title="HOTSPOT STATES" colors={colors}>
            {topStates.map(([state, count], idx) => (
              <View key={state} style={styles.hotspotRow}>
                <View style={[styles.hotspotRank, { backgroundColor: idx === 0 ? PRIMARY : colors.muted }]}>
                  <Text style={[styles.hotspotRankText, { color: idx === 0 ? "#fff" : colors.mutedForeground }]}>{idx + 1}</Text>
                </View>
                <HorizontalBar colors={colors} label={state} value={count} max={maxState} color={PRIMARY} />
              </View>
            ))}
          </Section>
        )}

        <Section title="OPERATIONAL INSIGHTS" colors={colors}>
          {topOfficer && (
            <View style={[styles.insightRow, { borderBottomColor: colors.border }]}>
              <Feather name="award" size={16} color={PRIMARY} />
              <Text style={[styles.insightText, { color: colors.text }]}>{topOfficer.name} filed the most reports ({topOfficer.count}).</Text>
            </View>
          )}
          <View style={[styles.insightRow, { borderBottomColor: colors.border }]}>
            <Feather name="trending-up" size={16} color={PRIMARY} />
            <Text style={[styles.insightText, { color: colors.text }]}>Clearance rate (arrested + closed) is {clearanceRate}%.</Text>
          </View>
          <View style={[styles.insightRow, { borderBottomWidth: 0 }]}>
            <Feather name="alert-triangle" size={16} color="#C0392B" />
            <Text style={[styles.insightText, { color: colors.text }]}>{stats.suspectsAtLarge} suspect{stats.suspectsAtLarge !== 1 ? "s" : ""} still at large across open cases.</Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6, textAlign: "center" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  summaryRow: { flexDirection: "row" },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  summaryIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  barLabel: { width: 90, fontSize: 12, fontFamily: "Inter_500Medium" },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  barValue: { width: 28, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  trendMeta: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  trendChart: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  trendCol: { flex: 1, alignItems: "center", gap: 4 },
  trendCount: { fontSize: 10, fontFamily: "Inter_600SemiBold", height: 14, lineHeight: 14 },
  trendBarTrack: { width: "100%", justifyContent: "flex-end", borderRadius: 6, overflow: "hidden" },
  trendDay: { fontSize: 11, marginTop: 2, fontFamily: "Inter_500Medium" },
  sevGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sevCard: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 2 },
  sevValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sevLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  statusLabel: { width: 90, fontSize: 12, fontFamily: "Inter_500Medium" },
  statusTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  statusPct: { width: 28, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  hotspotRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  hotspotRank: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  hotspotRankText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  insightText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  clearanceCard: { flexDirection: "row", borderRadius: 18, borderWidth: 1, marginTop: 14, overflow: "hidden", alignItems: "center" },
  clearanceArc: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: "center", justifyContent: "center", margin: 16 },
  clearancePct: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 22 },
  clearanceSub: { fontSize: 10, fontFamily: "Inter_500Medium" },
  clearanceDivider: { width: 1, marginVertical: 16 },
  clearanceRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 8 },
  clearanceMetric: { alignItems: "center", gap: 4 },
  clearanceVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  clearanceLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  clearanceMetricDivider: { width: 1, height: 30 },
});
