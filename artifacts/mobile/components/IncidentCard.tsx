import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Incident } from "@/context/IncidentContext";
import { StatusBadge } from "./StatusBadge";

interface IncidentCardProps {
  incident: Incident;
}

const TYPE_ICONS: Record<string, string> = {
  crash: "alert-triangle",
  breakdown: "tool",
  hazard: "alert-circle",
  flooding: "droplet",
};

export function IncidentCard({ incident }: IncidentCardProps) {
  const colors = useColors();
  const router = useRouter();

  const timeAgo = formatTimeAgo(incident.dateTime);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/case/${incident.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: getIconBg(incident.severity, colors) }]}>
          <Feather
            name={TYPE_ICONS[incident.type] as any || "alert-triangle"}
            size={18}
            color={getIconColor(incident.severity, colors)}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.id, { color: colors.mutedForeground }]}>{incident.id}</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {incident.title}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>

      <View style={styles.location}>
        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
        <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
          {incident.location}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.badges}>
          <StatusBadge type="severity" value={incident.severity} small />
          <StatusBadge type="status" value={incident.status} small />
        </View>
        <View style={styles.timeRow}>
          {incident.pendingSync && (
            <Feather name="cloud-off" size={12} color={colors.warning} style={{ marginRight: 4 }} />
          )}
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getIconBg(severity: string, colors: ReturnType<typeof useColors>) {
  switch (severity) {
    case "fatal": return colors.fatalLight;
    case "serious": return colors.seriousLight;
    case "minor": return colors.minorLight;
    default: return colors.muted;
  }
}

function getIconColor(severity: string, colors: ReturnType<typeof useColors>) {
  switch (severity) {
    case "fatal": return colors.fatal;
    case "serious": return colors.serious;
    case "minor": return colors.minor;
    default: return colors.mutedForeground;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerText: {
    flex: 1,
    marginRight: 6,
  },
  id: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
