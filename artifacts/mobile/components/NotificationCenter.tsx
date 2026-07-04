import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AppNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  notificationPreferenceKeyForUser,
  NotificationPreferences,
  updateNotificationPreferences,
} from "@/services/notificationService";
import {
  listNotifications,
  markAllRead as markAllReadApi,
  markRead,
  savePushToken as savePushTokenApi,
} from "@/services/notificationRepository";
import { registerForPushNotifications } from "@/services/pushNotificationService";

const PRIORITY_COLORS = {
  low: "#6B7280",
  normal: "#0F4C81",
  high: "#D35400",
  critical: "#C0392B",
};

export function NotificationCenter({ bottomPadding = 28 }: { bottomPadding?: number }) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [reference, setReference] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const prefKey = user
    ? notificationPreferenceKeyForUser(undefined, user.agency === "admin" || user.role === "admin" || user.role === "super_admin" ? "admin" : user.agency)
    : notificationPreferenceKeyForUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await getNotificationPreferences(prefKey);
      setPreferences(prefs);
      if (!user) {
        setNotifications(await listNotifications({ audience: "citizen", reportReference: reference.trim() || undefined }));
      } else if (user.agency === "admin" || user.role === "admin" || user.role === "super_admin") {
        setNotifications(await listNotifications({ audience: "admin", agency: "admin" }));
      } else {
        const [agencyNotifications, userNotifications] = await Promise.all([
          listNotifications({ agency: user.agency }),
          listNotifications({ userId: user.id }),
        ]);
        const byId = new Map([...agencyNotifications, ...userNotifications].map((item) => [item.id, item]));
        setNotifications([...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } finally {
      setLoading(false);
    }
  }, [prefKey, reference, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const unread = useMemo(() => notifications.filter((notification) => !notification.readAt).length, [notifications]);

  async function markOneRead(notification: AppNotification) {
    await markRead(notification.id);
    if (notification.route) router.push(notification.route as any);
    await load();
  }

  async function markAllRead() {
    await markAllReadApi(
      user
        ? user.agency === "admin" || user.role === "admin" || user.role === "super_admin"
          ? { agency: "admin" }
          : { agency: user.agency }
        : { audience: "citizen", reportReference: reference.trim() || undefined },
    );
    await load();
  }

  async function updatePrefs(updates: Partial<NotificationPreferences>) {
    setPreferences(await updateNotificationPreferences(prefKey, updates));
  }

  async function tryPushRegistration() {
    const result = await registerForPushNotifications();
    if (result.ok && result.token) {
      // Register the device token with the backend so it receives real pushes.
      await savePushTokenApi(result.token);
    }
    setPushMessage(result.ok ? "Push notifications are ready." : result.reason ?? "Push notification setup is not available yet.");
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: user?.agency === "police" ? "#1A3A6C" : user?.agency === "vio" ? "#7B3F00" : user?.agency === "civil_defence" ? "#234E2A" : user?.agency === "admin" ? "#344054" : "#0F4C81" }]}>
        <Feather name="bell" size={30} color="#fff" />
        <Text style={styles.heroTitle}>Notification Centre</Text>
        <Text style={styles.heroSub}>
          {user ? "Agency and operational alerts stored locally for this demo." : "Search your report reference to see citizen notifications."}
        </Text>
      </View>

      {!user ? (
        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.searchLabel, { color: colors.text }]}>Report reference</Text>
          <View style={[styles.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={reference}
              onChangeText={(value) => setReference(value.toUpperCase())}
              placeholder="CIR-ABC123"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={load}
            />
            <TouchableOpacity style={styles.searchButton} onPress={load}>
              <Feather name="search" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{unread}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Unread</Text>
        </View>
        <TouchableOpacity style={[styles.markReadBtn, { borderColor: colors.border }]} onPress={markAllRead}>
          <Feather name="check-circle" size={15} color={colors.text} />
          <Text style={[styles.markReadText, { color: colors.text }]}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.prefCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
        <PrefRow label="Enable notifications" value={preferences.enabled} onChange={(enabled) => updatePrefs({ enabled })} />
        <PrefRow label="High-priority only" value={preferences.highPriorityOnly} onChange={(highPriorityOnly) => updatePrefs({ highPriorityOnly })} />
        <PrefRow label="Assignment alerts" value={preferences.agencyAssignmentAlerts} onChange={(agencyAssignmentAlerts) => updatePrefs({ agencyAssignmentAlerts })} />
        <PrefRow label="Status updates" value={preferences.statusUpdateAlerts} onChange={(statusUpdateAlerts) => updatePrefs({ statusUpdateAlerts })} />
        <TouchableOpacity style={[styles.pushButton, { borderColor: colors.border }]} onPress={tryPushRegistration}>
          <Feather name="smartphone" size={16} color={colors.text} />
          <Text style={[styles.pushText, { color: colors.text }]}>Check push readiness</Text>
        </TouchableOpacity>
        {pushMessage ? <Text style={[styles.pushMessage, { color: colors.mutedForeground }]}>{pushMessage}</Text> : null}
      </View>

      <View style={styles.listHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>{notifications.length} total</Text>
      </View>

      {loading ? <ActivityIndicator color="#0F4C81" style={{ marginTop: 24 }} /> : null}
      {!loading && notifications.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="inbox" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications found.</Text>
        </View>
      ) : null}

      {notifications.map((notification) => (
        <TouchableOpacity
          key={notification.id}
          activeOpacity={0.78}
          style={[styles.notificationCard, { backgroundColor: colors.card, borderColor: notification.readAt ? colors.border : PRIORITY_COLORS[notification.priority] + "66" }]}
          onPress={() => markOneRead(notification)}
        >
          <View style={[styles.notificationIcon, { backgroundColor: PRIORITY_COLORS[notification.priority] + "16" }]}>
            <Feather name={iconForType(notification.type)} size={17} color={PRIORITY_COLORS[notification.priority]} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.notificationTop}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>{notification.title}</Text>
              {!notification.readAt ? <View style={[styles.unreadDot, { backgroundColor: PRIORITY_COLORS[notification.priority] }]} /> : null}
            </View>
            <Text style={[styles.notificationMessage, { color: colors.mutedForeground }]}>{notification.message}</Text>
            <Text style={[styles.notificationMeta, { color: colors.mutedForeground }]}>
              {new Date(notification.createdAt).toLocaleString()}
              {notification.reportReference ? ` · ${notification.reportReference}` : ""}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function PrefRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.prefRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.prefLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: "#0F4C8188" }}
        thumbColor={value ? "#0F4C81" : colors.mutedForeground}
      />
    </View>
  );
}

function iconForType(type: AppNotification["type"]): keyof typeof Feather.glyphMap {
  const icons: Record<AppNotification["type"], keyof typeof Feather.glyphMap> = {
    citizen_report_submitted: "send",
    case_assigned: "user-check",
    status_changed: "refresh-cw",
    report_reassigned: "repeat",
    agency_referral_received: "git-pull-request",
    nearby_high_priority_alert: "alert-octagon",
    officer_dispatch_request: "radio",
    admin_action: "settings",
  };
  return icons[type];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: 22, padding: 18, marginBottom: 14 },
  heroTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 10 },
  heroSub: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, marginTop: 6 },
  searchCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12, gap: 8 },
  searchLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  searchBox: { minHeight: 50, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", paddingLeft: 12 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  searchButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#0F4C81", alignItems: "center", justifyContent: "center", marginRight: 5 },
  summaryCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  summaryValue: { fontSize: 26, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  markReadBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  markReadText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  prefCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  prefRow: { borderTopWidth: 1, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prefLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pushButton: { minHeight: 44, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  pushText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  pushMessage: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17, marginTop: 8 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  notificationCard: { flexDirection: "row", gap: 11, borderWidth: 1, borderRadius: 15, padding: 13, marginBottom: 10 },
  notificationIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  notificationTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  notificationTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  unreadDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  notificationMessage: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18, marginTop: 4 },
  notificationMeta: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 22, alignItems: "center", gap: 9 },
  emptyText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
