import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

type Filter = "all" | "fatal" | "serious" | "minor";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Fatal", value: "fatal" },
  { label: "Serious", value: "serious" },
  { label: "Minor", value: "minor" },
];

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incidents } = useIncidents();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Incident | null>(null);

  const topPad = insets.top + 67;
  const bottomPad = insets.bottom + 34 + 90;

  const filtered =
    filter === "all" ? incidents : incidents.filter((i) => i.severity === filter);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad }]}>
        <Text style={styles.headerTitle}>Live Map</Text>
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

      {/* Incident list */}
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPad, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
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
                  {inc.location}
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

      {/* Count pill */}
      <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
        <Text style={styles.countText}>{filtered.length} incidents</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 10,
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
  countPill: {
    position: "absolute",
    right: 16,
    bottom: 110,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    opacity: 0.9,
  },
  countText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
