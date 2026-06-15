import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getUnreadNotificationCount } from "@/services/notificationService";

export function NotificationAccessCard({
  accentColor,
  compact = false,
}: {
  accentColor: string;
  compact?: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getUnreadNotificationCount({
        agency: user.agency === "admin" || user.role === "admin" || user.role === "super_admin" ? "admin" : user.agency,
      }).then(setUnread);
    }, [user]),
  );

  if (!user) return null;

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.compact, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push("/notifications" as any)}
      activeOpacity={0.82}
    >
      <View style={[styles.icon, { backgroundColor: accentColor + "18" }]}>
        <Feather name="bell" size={18} color={accentColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {unread > 0 ? `${unread} unread alert${unread === 1 ? "" : "s"}` : "All caught up"}
        </Text>
      </View>
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: accentColor }]}>
          <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 64, borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  compact: { marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  badge: { minWidth: 26, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
});
