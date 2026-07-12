import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Lightweight in-screen header with a back affordance for admin tool screens
 * that are reached from the Profile › Admin Tools section (they are hidden from
 * the tab bar, so they have no system back button of their own).
 */
export function ToolBackHeader({ title }: { title: string }) {
  const colors = useColors();
  const router = useRouter();

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(admin)/profile" as any);
    }
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={goBack}
        style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Go back"
      >
        <Feather name="chevron-left" size={20} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  btn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
});
