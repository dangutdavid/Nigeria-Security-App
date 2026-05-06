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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
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

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incidents } = useIncidents();
  const router = useRouter();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const topPad = insets.top;
  const bottomPad = insets.bottom + 90;

  const SEVERITY_FILTERS = [
    { label: "All", value: "all" },
    { label: "Fatal", value: "fatal" },
    { label: "Serious", value: "serious" },
    { label: "Minor", value: "minor" },
  ];

  const TYPE_FILTERS = [
    { label: "All Types", value: "all" },
    { label: "Crash", value: "crash" },
    { label: "Breakdown", value: "breakdown" },
    { label: "Hazard", value: "hazard" },
    { label: "Flooding", value: "flooding" },
  ];

  const filtered = incidents.filter((i) => {
    const sev = filter === "all" || i.severity === filter;
    const typ = typeFilter === "all" || i.type === typeFilter;
    return sev && typ;
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Floating header */}
      <View
        style={[
          styles.floatingHeader,
          { top: topPad + 8, backgroundColor: colors.card },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Live Map</Text>
          <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
            {filtered.length} incident{filtered.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {/* Severity filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {SEVERITY_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === f.value ? colors.primary : colors.muted,
                  borderColor: filter === f.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.chipText, { color: filter === f.value ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filtersRow, { marginTop: 4 }]}>
          {TYPE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                styles.chipSmall,
                {
                  backgroundColor: typeFilter === f.value ? colors.secondary : colors.muted,
                  borderColor: typeFilter === f.value ? colors.secondary : colors.border,
                },
              ]}
              onPress={() => setTypeFilter(f.value)}
            >
              <Text style={[styles.chipText, { color: typeFilter === f.value ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map */}
      <MapView
          style={styles.map}
          initialRegion={{
            latitude: 9.0765,
            longitude: 7.3986,
            latitudeDelta: 1.5,
            longitudeDelta: 1.5,
          }}
        >
          {filtered.map((inc) => (
            <Marker
              key={inc.id}
              coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
              pinColor={SEVERITY_COLORS[inc.severity]}
              onPress={() => setSelected(inc)}
            />
          ))}
        </MapView>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {Object.entries(SEVERITY_COLORS).map(([sev, col]) => (
          <View key={sev} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: col }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>
              {sev.replace("_", " ")}
            </Text>
          </View>
        ))}
      </View>

      {/* Selected incident card */}
      {selected && (
        <View
          style={[
            styles.selectedCard,
            { backgroundColor: colors.card, borderColor: colors.border, bottom: bottomPad + 10 },
          ]}
        >
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setSelected(null)}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.selId, { color: colors.mutedForeground }]}>{selected.id}</Text>
          <Text style={[styles.selTitle, { color: colors.text }]} numberOfLines={2}>{selected.title}</Text>
          <View style={styles.selLocation}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.selLocationText, { color: colors.mutedForeground }]}>
              {selected.location}
            </Text>
          </View>
          <View style={styles.selFooter}>
            <StatusBadge type="severity" value={selected.severity} small />
            <StatusBadge type="status" value={selected.status} small />
            <TouchableOpacity
              style={[styles.viewBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setSelected(null);
                router.push(`/case/${selected.id}` as any);
              }}
            >
              <Text style={styles.viewBtnText}>View</Text>
              <Feather name="arrow-right" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  floatingHeader: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  headerCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  filtersRow: {
    gap: 6,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  countPill: {
    position: "absolute",
    right: 14,
    top: "35%",
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
  legend: {
    position: "absolute",
    left: 14,
    bottom: 100,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  selectedCard: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  selId: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  selTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
    paddingRight: 24,
  },
  selLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  selLocationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  selFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
