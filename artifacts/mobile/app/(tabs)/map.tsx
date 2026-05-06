import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useIncidents, Incident } from "@/context/IncidentContext";
import { StatusBadge } from "@/components/StatusBadge";

const SEVERITY_COLORS: Record<string, string> = {
  fatal: "#8B0000",
  serious: "#E67E22",
  minor: "#27AE60",
  property_only: "#6B7A8A",
};

const SEVERITY_ORDER = ["fatal", "serious", "minor", "property_only"];

type Filter = "all" | "fatal" | "serious" | "minor";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Fatal", value: "fatal" },
  { label: "Serious", value: "serious" },
  { label: "Minor", value: "minor" },
];

interface StateStats {
  state: string;
  total: number;
  fatal: number;
  serious: number;
  minor: number;
  property_only: number;
}

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incidents } = useIncidents();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const topPad = insets.top + 67;
  const bottomPad = insets.bottom + 34 + 90;

  const filtered =
    filter === "all" ? incidents : incidents.filter((i) => i.severity === filter);

  const stateStats = useMemo<StateStats[]>(() => {
    const map: Record<string, StateStats> = {};
    for (const inc of incidents) {
      const s = inc.state || "Unknown";
      if (!map[s]) map[s] = { state: s, total: 0, fatal: 0, serious: 0, minor: 0, property_only: 0 };
      map[s].total++;
      const sev = inc.severity as keyof StateStats;
      if (typeof map[s][sev] === "number") (map[s][sev] as number)++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [incidents]);

  const maxTotal = stateStats.length > 0 ? stateStats[0].total : 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Live Map</Text>
          <TouchableOpacity
            style={[styles.reportFabInline, { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.35)" }]}
            onPress={() => router.push("/report" as any)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.reportFabInlineText}>Report</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === f.value ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                  borderColor: filter === f.value ? "#fff" : "rgba(255,255,255,0.2)",
                },
              ]}
              onPress={() => setFilter(f.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: filter === f.value ? "#fff" : "rgba(255,255,255,0.7)" },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Web placeholder notice */}
      <View style={[styles.noticeBar, { backgroundColor: colors.accent, borderColor: colors.border }]}>
        <Feather name="info" size={13} color={colors.accentForeground} />
        <Text style={[styles.noticeText, { color: colors.accentForeground }]}>
          Interactive map available on mobile — scan the QR code with Expo Go
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPad, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* State Heatmap */}
        {stateStats.length > 0 && (
          <View style={[styles.heatmapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.heatmapHeader}
              onPress={() => setShowHeatmap((v) => !v)}
              activeOpacity={0.75}
            >
              <View style={styles.heatmapHeaderLeft}>
                <Feather name="thermometer" size={15} color={colors.primary} />
                <Text style={[styles.heatmapTitle, { color: colors.text }]}>State Severity Breakdown</Text>
              </View>
              <Feather name={showHeatmap ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {showHeatmap && (
              <View style={styles.heatmapBody}>
                {stateStats.map((ss) => {
                  const barWidth = ss.total / maxTotal;
                  return (
                    <View key={ss.state} style={styles.heatmapRow}>
                      <Text style={[styles.heatmapState, { color: colors.text }]} numberOfLines={1}>
                        {ss.state}
                      </Text>
                      <View style={styles.heatmapBarWrap}>
                        <View style={[styles.heatmapBarBg, { backgroundColor: colors.muted }]}>
                          {SEVERITY_ORDER.map((sev) => {
                            const count = ss[sev as keyof StateStats] as number;
                            if (!count) return null;
                            const segWidth = (count / ss.total) * barWidth;
                            return (
                              <View
                                key={sev}
                                style={[styles.heatmapBarSeg, { flex: count, backgroundColor: SEVERITY_COLORS[sev] }]}
                              />
                            );
                          })}
                        </View>
                      </View>
                      <View style={styles.heatmapCountWrap}>
                        <Text style={[styles.heatmapCount, { color: colors.text }]}>{ss.total}</Text>
                        {ss.fatal > 0 && (
                          <View style={[styles.heatmapFatalDot, { backgroundColor: SEVERITY_COLORS.fatal }]}>
                            <Text style={styles.heatmapFatalNum}>{ss.fatal}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Legend */}
                <View style={[styles.heatmapLegend, { borderTopColor: colors.border }]}>
                  {SEVERITY_ORDER.map((sev) => (
                    <View key={sev} style={styles.heatmapLegendItem}>
                      <View style={[styles.heatmapLegendDot, { backgroundColor: SEVERITY_COLORS[sev] }]} />
                      <Text style={[styles.heatmapLegendText, { color: colors.mutedForeground }]}>
                        {sev === "property_only" ? "Property" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Incident list header */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.listHeaderText, { color: colors.mutedForeground }]}>
            {filtered.length} incident{filtered.length !== 1 ? "s" : ""}
            {filter !== "all" ? ` · ${filter}` : ""}
          </Text>
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="map" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No incidents for this filter
            </Text>
          </View>
        )}
        {filtered.map((inc) => (
          <TouchableOpacity
            key={inc.id}
            activeOpacity={0.75}
            onPress={() => setSelected(selected?.id === inc.id ? null : inc)}
            style={[
              styles.incCard,
              {
                backgroundColor: colors.card,
                borderColor: selected?.id === inc.id ? colors.primary : colors.border,
                borderWidth: selected?.id === inc.id ? 2 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.severityDot,
                { backgroundColor: SEVERITY_COLORS[inc.severity] },
              ]}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.incTitle, { color: colors.text }]} numberOfLines={1}>
                {inc.title}
              </Text>
              <View style={styles.incMeta}>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[styles.incLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {inc.lga ? `${inc.lga}, ` : ""}{inc.state || inc.location}
                </Text>
              </View>
              <View style={styles.incBadges}>
                <StatusBadge type="severity" value={inc.severity} small />
                <StatusBadge type="status" value={inc.status} small />
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/case/${inc.id}` as any)}
              style={[styles.viewBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="arrow-right" size={14} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Report FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/report" as any)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  reportFabInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  reportFabInlineText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  filtersRow: {
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  noticeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  heatmapCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  heatmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  heatmapHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heatmapTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  heatmapBody: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  heatmapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heatmapState: {
    width: 72,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  heatmapBarWrap: {
    flex: 1,
  },
  heatmapBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    flexDirection: "row",
  },
  heatmapBarSeg: {
    height: "100%",
  },
  heatmapCountWrap: {
    width: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  heatmapCount: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  heatmapFatalDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  heatmapFatalNum: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  heatmapLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
  },
  heatmapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heatmapLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heatmapLegendText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  listHeaderRow: {
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  listHeaderText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  incCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  incTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  incMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  incLocation: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  incBadges: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  viewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 110,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 14px rgba(0,0,0,0.25)",
  },
});
