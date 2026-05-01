import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { IncidentStatus, SeverityLevel } from "@/context/IncidentContext";

interface StatusBadgeProps {
  type: "status" | "severity";
  value: IncidentStatus | SeverityLevel;
  small?: boolean;
}

export function StatusBadge({ type, value, small }: StatusBadgeProps) {
  const colors = useColors();

  const statusConfig: Record<IncidentStatus, { label: string; bg: string; text: string }> = {
    draft: { label: "Draft", bg: colors.muted, text: colors.mutedForeground },
    submitted: { label: "Submitted", bg: colors.infoLight, text: colors.info },
    assigned: { label: "Assigned", bg: colors.warningLight, text: colors.warning },
    under_review: { label: "Under Review", bg: colors.accentForeground + "20", text: colors.secondary },
    closed: { label: "Closed", bg: colors.successLight, text: colors.success },
  };

  const severityConfig: Record<SeverityLevel, { label: string; bg: string; text: string }> = {
    fatal: { label: "Fatal", bg: colors.fatalLight, text: colors.fatal },
    serious: { label: "Serious", bg: colors.seriousLight, text: colors.serious },
    minor: { label: "Minor", bg: colors.minorLight, text: colors.minor },
    property_only: { label: "Property", bg: colors.propertyLight, text: colors.property },
  };

  const config =
    type === "status"
      ? statusConfig[value as IncidentStatus]
      : severityConfig[value as SeverityLevel];

  if (!config) return null;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.small]}>
      <Text style={[styles.label, { color: config.text }, small && styles.smallText]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  smallText: {
    fontSize: 10,
  },
});
