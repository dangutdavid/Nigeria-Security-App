import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  bgColor?: string;
  subtitle?: string;
}

export function MetricCard({ label, value, icon, color, bgColor, subtitle }: MetricCardProps) {
  const colors = useColors();
  const iconColor = color || colors.primary;
  const iconBg = bgColor || colors.successLight;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: iconColor }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  value: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
});
