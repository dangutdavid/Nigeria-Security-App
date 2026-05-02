import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";

export function SyncBanner() {
  const colors = useColors();
  const { pendingCount, isOffline, syncPending } = useIncidents();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOffline) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [isOffline]);

  if (!isOffline && pendingCount === 0) return null;

  const bgColor = isOffline ? colors.warningLight : colors.infoLight;
  const borderColor = isOffline ? colors.warning : colors.info;
  const textColor = isOffline ? colors.warning : colors.info;
  const iconName = isOffline ? "cloud-off" : "upload-cloud";

  const label = isOffline
    ? pendingCount > 0
      ? `Offline — ${pendingCount} report${pendingCount > 1 ? "s" : ""} queued for sync`
      : "Offline — new reports saved locally"
    : `${pendingCount} report${pendingCount > 1 ? "s" : ""} pending sync`;

  return (
    <View style={[styles.banner, { backgroundColor: bgColor, borderColor }]}>
      <Animated.View style={{ opacity: isOffline ? pulse : 1 }}>
        <Feather name={iconName} size={15} color={textColor} />
      </Animated.View>
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {!isOffline && pendingCount > 0 && (
        <TouchableOpacity onPress={syncPending} style={styles.syncBtn}>
          <Text style={[styles.syncText, { color: textColor }]}>Sync now</Text>
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
    paddingVertical: 9,
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
