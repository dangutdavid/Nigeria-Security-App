import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useIncidents } from "@/context/IncidentContext";
import { formatMinutesAgo, getAlertRadiusMiles, useTheftReports } from "@/context/TheftReportContext";

const DISMISSED_KEY = "@frsc_dismissed_alerts";
const READ_KEY = "@frsc_read_alerts";

interface Alert {
  id: string;
  type: "assignment" | "escalation" | "update" | "sync" | "critical";
  title: string;
  message: string;
  time: string;
  read: boolean;
  incidentId?: string;
}

function buildAlerts(
  incidents: ReturnType<typeof useIncidents>["incidents"],
  role: string,
  userId?: string,
): Alert[] {
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

  if (role === "field_officer" && userId) {
    const assignedToMe = incidents.filter(
      (i) => i.assignedTo === userId && i.status !== "closed",
    );
    if (assignedToMe.length > 0) {
      alerts.push({
        id: "a-assigned-me",
        type: "assignment",
        title: `${assignedToMe.length} case${assignedToMe.length > 1 ? "s" : ""} assigned to you`,
        message: assignedToMe
          .slice(0, 2)
          .map((i) => i.title)
          .join(" · "),
        time: "Active",
        read: false,
        incidentId: assignedToMe[0].id,
      });
    }
    const myDrafts = incidents.filter((i) => i.reportedBy === userId && i.status === "draft");
    if (myDrafts.length > 0) {
      alerts.push({
        id: "a-drafts",
        type: "update",
        title: `${myDrafts.length} unsent draft${myDrafts.length > 1 ? "s" : ""}`,
        message: "You have saved drafts that haven't been submitted yet.",
        time: "Pending",
        read: true,
        incidentId: myDrafts[0].id,
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
      i.status === "submitted",
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
  const { nearbyAlerts, reports: theftReports, locationPermission, requestLocationPermission } = useTheftReports();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const activeTheftCount = theftReports.filter((r) => r.status === "active").length;

  useEffect(() => {
    AsyncStorage.multiGet([DISMISSED_KEY, READ_KEY]).then((results) => {
      const d = results[0][1];
      const r = results[1][1];
      if (d) setDismissed(JSON.parse(d));
      if (r) setReadIds(JSON.parse(r));
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissed((prev) => {
      const next = [...prev, id];
      void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const dismissAll = useCallback((ids: string[]) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDismissed((prev) => {
      const next = [...new Set([...prev, ...ids])];
      void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids: string[]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReadIds((prev) => {
      const next = [...new Set([...prev, ...ids])];
      void AsyncStorage.setItem(READ_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const allAlerts = useMemo(
    () => buildAlerts(incidents, user?.role || "field_officer", user?.id),
    [incidents, user?.role, user?.id],
  );

  const alerts = useMemo(
    () => allAlerts.filter((a) => !dismissed.includes(a.id)).map((a) => ({
      ...a,
      read: a.read || readIds.includes(a.id),
    })),
    [allAlerts, dismissed, readIds]
  );

  const unreadCount = alerts.filter((a) => !a.read).length;
  const visibleAlerts = useMemo(
    () => unreadOnly ? alerts.filter((a) => !a.read) : alerts,
    [alerts, unreadOnly]
  );

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
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Alerts</Text>
            {alerts.length > 0 && (
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All read"} · {alerts.length} total
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.fatal }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => markAllRead(alerts.filter((a) => !a.read).map((a) => a.id))}
              activeOpacity={0.75}
              style={[styles.headerAction, { borderColor: colors.border }]}
            >
              <Feather name="check-circle" size={13} color={colors.primary} />
              <Text style={[styles.headerActionText, { color: colors.primary }]}>Read all</Text>
            </TouchableOpacity>
          )}
          {alerts.length > 0 && (
            <TouchableOpacity
              onPress={() => dismissAll(alerts.map((a) => a.id))}
              activeOpacity={0.75}
              style={[styles.headerAction, { borderColor: colors.border }]}
            >
              <Feather name="trash-2" size={13} color={colors.mutedForeground} />
              <Text style={[styles.headerActionText, { color: colors.mutedForeground }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.subRow}>
          <Text style={[styles.sub, { color: colors.mutedForeground, flex: 1 }]}>
            {unreadCount > 0
              ? `${unreadCount} unread · ${alerts.length} total`
              : alerts.length > 0
                ? `${alerts.length} notification${alerts.length > 1 ? "s" : ""} · all read`
                : "No active notifications"}
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => setUnreadOnly((v) => !v)}
              style={[styles.unreadToggle, { backgroundColor: unreadOnly ? colors.primary : colors.muted, borderColor: unreadOnly ? colors.primary : colors.border }]}
              activeOpacity={0.75}
            >
              <Text style={[styles.unreadToggleText, { color: unreadOnly ? "#fff" : colors.mutedForeground }]}>
                {unreadOnly ? "Unread only ✓" : "Unread only"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stolen Vehicle Alert Banner */}
      {activeTheftCount > 0 && (
        <TouchableOpacity
          style={[styles.theftBanner, { backgroundColor: "#FEE8E8", borderColor: "#C0392B30" }]}
          onPress={() => router.push("/theft-alerts" as any)}
          activeOpacity={0.85}
        >
          <View style={[styles.theftBannerIcon, { backgroundColor: "#C0392B22" }]}>
            <Feather name="alert-triangle" size={18} color="#C0392B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.theftBannerTitle}>
              {nearbyAlerts.length > 0
                ? `${nearbyAlerts.length} Stolen Vehicle${nearbyAlerts.length > 1 ? "s" : ""} Nearby`
                : `${activeTheftCount} Active Stolen Vehicle Report${activeTheftCount > 1 ? "s" : ""}`}
            </Text>
            {nearbyAlerts.length > 0 && (
              <Text style={styles.theftBannerSub}>
                Nearest: {nearbyAlerts[0].plate} · {nearbyAlerts[0].color} {nearbyAlerts[0].make} · {formatMinutesAgo(nearbyAlerts[0].reportedAt)}
              </Text>
            )}
            {nearbyAlerts.length === 0 && locationPermission !== "granted" && (
              <Text style={styles.theftBannerSub}>Tap to enable location & see nearby alerts</Text>
            )}
          </View>
          <Feather name="chevron-right" size={16} color="#C0392B" />
        </TouchableOpacity>
      )}

      {alerts.length > 0 && (() => {
        const typeCounts: Record<string, number> = {};
        for (const a of alerts) typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1;
        const typeEntries = Object.entries(typeCounts).sort((x, y) => y[1] - x[1]);
        return (
          <View style={[styles.typeSummaryRow, { backgroundColor: colors.muted, borderBottomColor: colors.border }]}>
            {typeEntries.map(([type, count]) => (
              <View key={type} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: (ALERT_COLORS[type] ?? colors.primary) + "18" }}>
                <Feather name={ALERT_ICONS[type] as any} size={11} color={ALERT_COLORS[type] ?? colors.primary} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: ALERT_COLORS[type] ?? colors.primary }}>{count}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      <FlatList
        data={visibleAlerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!visibleAlerts.length}
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
              activeOpacity={0.8}
              onPress={() => {
                if (!item.read) markAllRead([item.id]);
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
                onPress={() => dismiss(item.id)}
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
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
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
  subRow: { flexDirection: "row", alignItems: "center", marginTop: 3, gap: 8 },
  unreadToggle: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  unreadToggleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  typeSummaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
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
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 6,
  },
  headerActionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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
  theftBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 14, marginTop: 10, marginBottom: 2, borderRadius: 14, borderWidth: 1, padding: 12 },
  theftBannerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  theftBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#C0392B" },
  theftBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#8B0000", marginTop: 2 },
});
