import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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
import { useColors } from "@/hooks/useColors";
import { useIncidents, Incident } from "@/context/IncidentContext";
import { StatusBadge } from "@/components/StatusBadge";

const { width, height } = Dimensions.get("window");

const SEVERITY_COLORS: Record<string, string> = {
  fatal: "#8B0000",
  serious: "#E67E22",
  minor: "#27AE60",
  property_only: "#6B7A8A",
};

// Safe import of react-native-maps
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = undefined;

if (Platform.OS !== "web") {
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch {
    // ignore
  }
}

function WebMapPlaceholder({ incidents, selected, onSelect }: { incidents: Incident[]; selected: Incident | null; onSelect: (i: Incident) => void }) {
  const colors = useColors();
  return (
    <View style={[webStyles.container, { backgroundColor: colors.muted }]}>
      <Feather name="map" size={48} color={colors.mutedForeground} />
      <Text style={[webStyles.title, { color: colors.text }]}>Incident Map</Text>
      <Text style={[webStyles.sub, { color: colors.mutedForeground }]}>
        Interactive map available on mobile device
      </Text>
      <ScrollView style={{ marginTop: 16, width: "100%", maxWidth: 400 }}>
        {incidents.map((inc) => (
          <TouchableOpacity
            key={inc.id}
            style={[webStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onSelect(inc)}
          >
            <View style={[webStyles.dot, { backgroundColor: SEVERITY_COLORS[inc.severity] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[webStyles.rowTitle, { color: colors.text }]} numberOfLines={1}>{inc.title}</Text>
              <Text style={[webStyles.rowSub, { color: colors.mutedForeground }]}>{inc.location}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rowTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  rowSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incidents } = useIncidents();
  const router = useRouter();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  const FILTERS = [
    { label: "All", value: "all" },
    { label: "Fatal", value: "fatal" },
    { label: "Serious", value: "serious" },
    { label: "Minor", value: "minor" },
  ];

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.severity === filter);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Floating header */}
      <View
        style={[
          styles.floatingHeader,
          { top: topPad + 8, backgroundColor: colors.card, shadowColor: "#000" },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Live Map</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map((f) => (
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
      </View>

      {/* Map or placeholder */}
      {Platform.OS !== "web" && MapView ? (
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
      ) : (
        <WebMapPlaceholder incidents={filtered} selected={selected} onSelect={setSelected} />
      )}

      {/* Incident count pill */}
      <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
        <Text style={styles.countText}>{filtered.length} incidents</Text>
      </View>

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
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
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
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
