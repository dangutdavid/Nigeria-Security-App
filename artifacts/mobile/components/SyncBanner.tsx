import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";

export function SyncBanner() {
  const colors = useColors();
  const { pendingCount, isOffline, syncPending } = useIncidents();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isOffline ? colors.warningLight : colors.infoLight,
          borderColor: isOffline ? colors.warning : colors.info,
        },
      ]}
    >
      <Feather
        name={isOffline ? "cloud-off" : "upload-cloud"}
        size={16}
        color={isOffline ? colors.warning : colors.info}
      />
      <Text
        style={[
          styles.text,
          { color: isOffline ? colors.warning : colors.info },
        ]}
      >
        {isOffline
          ? "No connection — reports saved locally"
          : `${pendingCount} report${pendingCount > 1 ? "s" : ""} pending sync`}
      </Text>
      {!isOffline && pendingCount > 0 && (
        <TouchableOpacity onPress={syncPending} style={styles.syncBtn}>
          <Text style={[styles.syncText, { color: colors.info }]}>Sync now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  syncBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  syncText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
