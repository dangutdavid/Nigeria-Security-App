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
import { useInspections } from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#7B3F00";
const { width } = Dimensions.get("window");
const BAR_MAX_WIDTH = width - 120;
const TREND_HEIGHT = 80;

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const RESULT_COLORS: Record<string, string> = {
  pass: "#27AE60",
  conditional: "#E67E22",
  fail: "#C0392B",
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

function SummaryCard({ label, value, icon, color, colors }: { label: string; value: string | number; icon: keyof typeof Feather.glyphMap; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function VIOAnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { inspections } = useInspections();

  const stats = useMemo(() => {
    const byResult: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const failedByCategory: Record<string, number> = {};
    inspections.forEach((insp) => {
      byResult[insp.result] = (byResult[insp.result] || 0) + 1;
      byCategory[insp.vehicleCategory] = (byCategory[insp.vehicleCategory] || 0) + 1;
      insp.items.forEach((it) => {
        if (it.status === "fail") failedByCategory[it.category] = (failedByCategory[it.category] || 0) + 1;
      });
    });
    return { byResult, byCategory, failedByCategory };
  }, [inspections]);

  const days = useMemo(() => {
    const result: Array<{ label: string; count: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      result.push({
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        count: inspections.filter((insp) => new Date(insp.inspectedAt).toDateString() === dayStr).length,
        isToday: i === 0,
      });
    }
    return result;
  }, [inspections]);
  const maxDay = Math.max(...days.map((d) => d.count), 1);
  const weekTotal = days.reduce((s, d) => s + d.count, 0);

  const passed = stats.byResult["pass"] || 0;
  const failed = stats.byResult["fail"] || 0;
  const conditional = stats.byResult["conditional"] || 0;
  const passRate = inspections.length > 0 ? Math.round((passed / inspections.length) * 100) : 0;

  const maxCategory = Math.max(...Object.values(stats.byCategory), 1);
  const topFailed = Object.entries(stats.failedByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxFailed = Math.max(...topFailed.map(([, c]) => c), 1);

  const topInspector = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    inspections.forEach((insp) => {
      if (!insp.inspectedBy) return;
      if (!counts[insp.inspectedBy]) counts[insp.inspectedBy] = { name: insp.inspectedByName, count: 0 };
      counts[insp.inspectedBy].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count)[0] ?? null;
  }, [inspections]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: PRIMARY, paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection Analytics</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={styles.headerSub}>{inspections.length} inspections · Zone overview</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <SummaryCard colors={colors} label="Inspections" value={inspections.length} icon="clipboard" color={PRIMARY} />
          <View style={{ width: 10 }} />
          <SummaryCard colors={colors} label="Passed" value={passed} icon="check-circle" color="#27AE60" />
        </View>
        <View style={[styles.summaryRow, { marginTop: 10 }]}>
          <SummaryCard colors={colors} label="Failed" value={failed} icon="x-circle" color="#C0392B" />
          <View style={{ width: 10 }} />
          <SummaryCard colors={colors} label="Pass Rate" value={`${passRate}%`} icon="percent" color="#2C7BE5" />
        </View>

        {inspections.length > 0 && (
          <View style={[styles.clearanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.clearanceArc, { borderColor: passRate >= 60 ? "#27AE60" : passRate >= 30 ? "#E67E22" : "#C0392B" }]}>
              <Text style={[styles.clearancePct, { color: passRate >= 60 ? "#27AE60" : passRate >= 30 ? "#E67E22" : "#C0392B" }]}>{passRate}%</Text>
              <Text style={[styles.clearanceSub, { color: colors.mutedForeground }]}>passed</Text>
            </View>
            <View style={[styles.clearanceDivider, { backgroundColor: colors.border }]} />
            <View style={styles.clearanceRight}>
              <View style={styles.clearanceMetric}>
                <Text style={[styles.clearanceVal, { color: "#27AE60" }]}>{passed}</Text>
                <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>pass</Text>
              </View>
              <View style={[styles.clearanceMetricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.clearanceMetric}>
                <Text style={[styles.clearanceVal, { color: "#E67E22" }]}>{conditional}</Text>
                <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>conditional</Text>
              </View>
              <View style={[styles.clearanceMetricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.clearanceMetric}>
                <Text style={[styles.clearanceVal, { color: "#C0392B" }]}>{failed}</Text>
                <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>fail</Text>
              </View>
            </View>
          </View>
        )}

        <Section title="7-DAY TREND" colors={colors}>
          <Text style={[styles.trendMeta, { color: colors.mutedForeground }]}>{weekTotal} inspections this week</Text>
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

        {Object.keys(stats.byResult).length > 0 && (
          <Section title="BY RESULT" colors={colors}>
            <View style={styles.sevGrid}>
              {(["pass", "conditional", "fail"] as const).filter((r) => stats.byResult[r]).map((res) => (
                <View key={res} style={[styles.sevCard, { backgroundColor: RESULT_COLORS[res] + "14", borderColor: RESULT_COLORS[res] + "30" }]}>
                  <Text style={[styles.sevValue, { color: RESULT_COLORS[res] }]}>{stats.byResult[res]}</Text>
                  <Text style={[styles.sevLabel, { color: colors.mutedForeground }]}>{titleCase(res)}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {Object.keys(stats.byCategory).length > 0 && (
          <Section title="BY VEHICLE CATEGORY" colors={colors}>
            {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <HorizontalBar key={cat} colors={colors} label={titleCase(cat)} value={count} max={maxCategory} color={PRIMARY} />
            ))}
          </Section>
        )}

        {topFailed.length > 0 && (
          <Section title="TOP FAILED CHECKS" colors={colors}>
            {topFailed.map(([cat, count], idx) => (
              <View key={cat} style={styles.hotspotRow}>
                <View style={[styles.hotspotRank, { backgroundColor: idx === 0 ? "#C0392B" : colors.muted }]}>
                  <Text style={[styles.hotspotRankText, { color: idx === 0 ? "#fff" : colors.mutedForeground }]}>{idx + 1}</Text>
                </View>
                <HorizontalBar colors={colors} label={cat} value={count} max={maxFailed} color="#C0392B" />
              </View>
            ))}
          </Section>
        )}

        <Section title="OPERATIONAL INSIGHTS" colors={colors}>
          {topInspector && (
            <View style={[styles.insightRow, { borderBottomColor: colors.border }]}>
              <Feather name="award" size={16} color={PRIMARY} />
              <Text style={[styles.insightText, { color: colors.text }]}>{topInspector.name} completed the most inspections ({topInspector.count}).</Text>
            </View>
          )}
          <View style={[styles.insightRow, { borderBottomColor: colors.border }]}>
            <Feather name="percent" size={16} color={PRIMARY} />
            <Text style={[styles.insightText, { color: colors.text }]}>Overall pass rate is {passRate}% across {inspections.length} inspections.</Text>
          </View>
          {topFailed.length > 0 && (
            <View style={[styles.insightRow, { borderBottomWidth: 0 }]}>
              <Feather name="alert-triangle" size={16} color="#C0392B" />
              <Text style={[styles.insightText, { color: colors.text }]}>“{topFailed[0][0]}” is the most common failed check ({topFailed[0][1]}).</Text>
            </View>
          )}
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
