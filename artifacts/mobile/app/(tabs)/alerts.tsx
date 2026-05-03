import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useIncidents } from "@/context/IncidentContext";

interface Alert {
  id: string;
  type: "assignment" | "escalation" | "update" | "sync" | "critical";
  title: string;
  message: string;
  time: string;
  read: boolean;
  incidentId?: string;
}

function buildAlerts(incidents: ReturnType<typeof useIncidents>["incidents"], role: string): Alert[] {
  const alerts: Alert[] = [];

  if (role === "supervisor" || role === "commander") {
    const unassigned = incidents.filter((i) => i.status === "submitted");
    if (unassigned.length > 0) {
      alerts.push({
        id: "a-unassigned",
        type: "escalation",
        title: `${unassigned.length} unassigned ${unassigned.length === 1 ? "case" : "cases"}`,
        message: "Review and assign pending incident reports to field officers.",
        time: "Now",
        read: false,
          incidentId: "unassigned",
      });
    }
  }

  const fatal = incidents.filter((i) => i.severity === "fatal" && i.status !== "closed");
  if (fatal.length > 0) {
    fatal.slice(0, 2).forEach((inc) => {
      alerts.push({
        id: `a-fatal-${inc.id}`,
        type: "critical",
        title: "Fatal incident open",
        message: inc.title,
        time: formatTimeAgo(inc.dateTime),
        read: false,
        incidentId: inc.id,
      });
    });
  }

  const recent = incidents.filter(
    (i) =>
      Date.now() - new Date(i.dateTime).getTime() < 3600000 * 6 &&
      i.status === "submitted"
  );
  recent.slice(0, 3).forEach((inc) => {
    alerts.push({
      id: `a-new-${inc.id}`,
      type: "update",
      title: "New incident submitted",
      message: inc.title,
      time: formatTimeAgo(inc.dateTime),
      read: true,
      incidentId: inc.id,
    });
  });

  alerts.push({
    id: "a-sync",
    type: "sync",
    title: "System sync complete",
    message: "All records synced to server. Last sync: Just now.",
    time: "5m ago",
    read: true,
  });

  return alerts;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ALERT_ICONS: Record<string, string> = {
  assignment: "user-check",
  escalation: "alert-triangle",
  update: "refresh-cw",
  sync: "upload-cloud",
  critical: "alert-octagon",
};

const ALERT_COLORS: Record<string, string> = {
  assignment: "#2C7BE5",
  escalation: "#E67E22",
  update: "#27AE60",
  sync: "#6B7A8A",
  critical: "#C0392B",
};

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { incidents } = useIncidents();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const alerts = useMemo(() => {
    return buildAlerts(incidents, user?.role || "field_officer").filter(
      (a) => !dismissed.includes(a.id)
    );
  }, [incidents, user?.role, dismissed]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.fatal }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
          </Text>
        )}
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!alerts.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All clear</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              No alerts at this time
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconColor = ALERT_COLORS[item.type];
          return (
            <TouchableOpacity
              style={[
                styles.alertCard,
                {
                  backgroundColor: colors.card,
                  borderColor: item.read ? colors.border : iconColor + "44",
                  borderLeftWidth: item.read ? 1 : 3,
                  borderLeftColor: item.read ? colors.border : iconColor,
                },
              ]}
              activeOpacity={item.incidentId ? 0.7 : 1}
              onPress={() => {
                if (item.incidentId === "unassigned") {
                  router.push("/(tabs)/cases?status=submitted" as any);
                  return;
                }
                if (item.incidentId) router.push(`/case/${item.incidentId}` as any);
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconColor + "18" }]}>
                <Feather name={ALERT_ICONS[item.type] as any} size={20} color={iconColor} />
              </View>
              <View style={styles.alertBody}>
                <View style={styles.alertTop}>
                  <Text style={[styles.alertTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  {!item.read && (
                    <View style={[styles.dot, { backgroundColor: iconColor }]} />
                  )}
                </View>
                <Text
                  style={[styles.alertMsg, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {item.message}
                </Text>
                <View style={styles.alertFooter}>
                  <Text style={[styles.alertTime, { color: colors.mutedForeground }]}>
                    {item.time}
                  </Text>
                  {item.incidentId && (
                    <Text style={[styles.viewLink, { color: colors.primary }]}>
                      {item.incidentId === "unassigned" ? "Review cases" : "View case"}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setDismissed((prev) => [...prev, item.id])}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  list: {
    padding: 14,
    gap: 8,
  },
  alertCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBody: {
    flex: 1,
  },
  alertTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  alertMsg: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  alertFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  alertTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  viewLink: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  dismissBtn: {
    padding: 4,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
