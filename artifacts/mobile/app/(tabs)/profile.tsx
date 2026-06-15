import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useIncidents } from "@/context/IncidentContext";
import { usePatrol } from "@/context/PatrolContext";
import { useReferrals } from "@/context/ReferralContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";
import { confirmAction } from "@/utils/confirm";

function SettingRow({
  icon,
  label,
  value,
  onPress,
  toggle,
  toggled,
  onToggle,
  destructive,
  subtitle,
  badge,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
  destructive?: boolean;
  subtitle?: string;
  badge?: number;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={toggle}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: destructive ? colors.fatalLight : colors.muted }]}> 
        <Feather name={icon as any} size={18} color={destructive ? colors.fatal : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: destructive ? colors.fatal : colors.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {value && <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{value}</Text>}
      {typeof badge === "number" && badge > 0 ? (
        <View style={[styles.settingBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.settingBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
      {toggle && onToggle ? (
        <Switch
          value={toggled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={toggled ? colors.primary : colors.mutedForeground}
        />
      ) : (
        onPress && <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { isOnDuty, activeSession, sessions } = usePatrol();
  const { incidents } = useIncidents();
  const { pendingCountFor } = useReferrals();
  const pendingReferrals = user ? pendingCountFor(user.agency) : 0;
  const myReportedIncs = incidents.filter((i) => i.reportedBy === user?.id);
  const myReported = myReportedIncs.length;
  const myVictims = myReportedIncs.reduce((s, i) => s + i.victims.length, 0);
  const myAssigned = incidents.filter((i) => i.assignedTo === user?.id && i.status !== "closed").length;
  const myClosed = incidents.filter((i) => i.reportedBy === user?.id && i.status === "closed").length;
  const myDrafts = incidents.filter((i) => i.reportedBy === user?.id && i.status === "draft").length;
  const myPatrolSessions = sessions.filter((s) => s.officerId === user?.id).length;
  const { can, roleLabel } = usePermissions();
  const canManageUsers = can("manage_users", "user");
  const canAssignCases = can("assign", "incident");
  const canUseCommandTools = canManageUsers;

  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  function handleLogout() {
    confirmAction({
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      confirmText: "Sign Out",
      destructive: true,
      onConfirm: () => {
        setLoggingOut(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace("/logout");
      },
    });
  }

  if (!user) return null;

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}> 
            <Text style={styles.avatarText}>{user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</Text>
          </View>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userBadge}>{user.badgeNumber}</Text>
        <View style={[styles.roleChip, { backgroundColor: "rgba(255,255,255,0.15)" }]}> 
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
        {(user.station || user.sector) && (
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", marginTop: 4 }}>
            {[user.station, user.sector].filter(Boolean).join(" · ")}
          </Text>
        )}
        {isOnDuty && (
          <View style={[styles.onDutyPill, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
            <View style={styles.onDutyDot} />
            <Text style={styles.onDutyText}>On Duty</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MY ACTIVITY</Text>
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{myReported}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Reported</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: myAssigned > 0 ? colors.primary : colors.text }]}>{myAssigned}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Assigned</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: myClosed > 0 ? colors.success : colors.text }]}>{myClosed}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Closed</Text>
          </View>
          {myDrafts > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{myDrafts}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Drafts</Text>
              </View>
            </>
          )}
          {myVictims > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.fatal }]}>{myVictims}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Victims</Text>
              </View>
            </>
          )}
          {myPatrolSessions > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.success }]}>{myPatrolSessions}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Patrols</Text>
              </View>
            </>
          )}
        </View>
        {myReported > 0 && (() => {
          const weekAgo = Date.now() - 7 * 86400000;
          const thisWeek = myReportedIncs.filter((i) => new Date(i.dateTime).getTime() >= weekAgo).length;
          const lastWeek = myReportedIncs.filter((i) => {
            const t = new Date(i.dateTime).getTime();
            return t >= weekAgo - 7 * 86400000 && t < weekAgo;
          }).length;
          const diff = thisWeek - lastWeek;
          return (
            <Text style={[styles.closureRate, { color: colors.mutedForeground }]}>
              {Math.round((myClosed / myReported) * 100)}% closure rate · {myReported} total
              {(thisWeek > 0 || lastWeek > 0) && ` · This week: ${thisWeek}${diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff} vs last)` : ""}`}
            </Text>
          );
        })()}
      </View>

      {myReported > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.myCasesBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/(tabs)/cases", params: { mine: "1" } } as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.myCasesIcon, { backgroundColor: colors.primary + "14" }]}>
              <Feather name="folder" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.myCasesLabel, { color: colors.text }]}>My Cases</Text>
              <Text style={[styles.myCasesSub, { color: colors.mutedForeground }]}>
                {myReported} reported · {myAssigned} assigned · {myClosed} closed
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <SettingRow
            icon={isOnDuty ? "check-circle" : "power"}
            label="Duty Status"
            value={isOnDuty ? "On duty" : "Off duty"}
            subtitle={activeSession ? activeSession.route : "Start a duty session"}
            onPress={() => router.push("/patrol-log")}
          />
          <SettingRow icon={isDark ? "moon" : "sun"} label="Theme" subtitle={isDark ? "Dark mode on" : "Light mode on"} toggle toggled={isDark} onToggle={toggleTheme} />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.dutyCta, { backgroundColor: isOnDuty ? colors.success : colors.primary }]}
          onPress={() => router.push("/patrol-log")}
          activeOpacity={0.85}
        >
          <Feather name={isOnDuty ? "check-circle" : "play"} size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dutyCtaTitle}>{isOnDuty ? "You’re on duty" : "Start duty now"}</Text>
            <Text style={styles.dutyCtaSub}>
              {activeSession ? activeSession.route : "Open your patrol log and begin a session"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONNECTIVITY</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <SettingRow icon="cloud-off" label="Offline Mode" toggle toggled={offlineMode} onToggle={setOfflineMode} />
          <SettingRow icon="upload-cloud" label="Auto Sync" toggle toggled={autoSync} onToggle={setAutoSync} />
          <SettingRow icon="map-pin" label="Location Sharing" toggle toggled={locationSharing} onToggle={setLocationSharing} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <SettingRow icon="shield" label="Badge Number" value={user.badgeNumber} />
          <SettingRow icon="briefcase" label="Role" value={roleLabel} />
          <SettingRow icon="mail" label="Email" value={user.email || "—"} />
          <SettingRow icon="map-pin" label="Station" value={user.station} />
          {user.sector ? <SettingRow icon="layers" label="Sector" value={user.sector} /> : null}
          <SettingRow icon="phone" label="Phone" value={user.phone} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TOOLS</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <SettingRow
            icon="anchor"
            label="Patrol Summary"
            subtitle="View active and recent patrol sessions"
            onPress={() => router.push("/patrol-log")}
          />
          <SettingRow
            icon="truck"
            label="Vehicle Lookup"
            subtitle="Check registration and owner records"
            onPress={() => router.push("/vehicle-lookup")}
          />
          <SettingRow
            icon="git-pull-request"
            label="Referrals"
            subtitle="Cross-agency shared records"
            badge={pendingReferrals}
            onPress={() => router.push("/referrals")}
          />
          <SettingRow
            icon="bell"
            label="Notifications"
            subtitle="Alerts, read state, and local preferences"
            onPress={() => router.push("/notifications" as any)}
          />
          {canAssignCases ? (
            <SettingRow
              icon="clipboard"
              label="Case Assignment"
              subtitle="Assign submitted incidents to officers"
              onPress={() => router.push("/(tabs)/cases?status=submitted" as any)}
            />
          ) : null}
          {canManageUsers ? (
            <SettingRow icon="users" label="Manage Users" subtitle="Create and assign officers" onPress={() => router.push("/users")} />
          ) : null}
          <SettingRow icon="key" label="Change PIN" subtitle="Update your login PIN" onPress={() => router.push("/change-pin")} />
          <SettingRow icon="help-circle" label="Forgot PIN" subtitle="Recover access with OTP" onPress={() => router.push("/forgot-pin")} />
          {canUseCommandTools ? (
            <SettingRow
              icon="settings"
              label="Settings & Sync"
              subtitle="Open profile settings and connectivity options"
              onPress={() => router.push("/patrol-log")}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/analytics")}
          activeOpacity={0.85}
        >
          <View style={[styles.analyticsIcon, { backgroundColor: colors.primary + "14" }]}>
            <Feather name="bar-chart-2" size={18} color={colors.primary} />
          </View>
          <View style={styles.analyticsCopy}>
            <Text style={[styles.analyticsTitle, { color: colors.text }]}>Analytics & Hotspots</Text>
            <Text style={[styles.analyticsSub, { color: colors.mutedForeground }]}>
              View trends, crash patterns, and operational insights
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.fatal }, loggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          activeOpacity={0.85}
          disabled={loggingOut}
        >
          <Feather name="log-out" size={16} color="#fff" />
          <Text style={styles.logoutText}>{loggingOut ? "Logging out..." : "Logout"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.appFooter}>
        <Text style={[styles.appFooterText, { color: colors.mutedForeground }]}>FRSC Field Operations · v1.0.0</Text>
        <Text style={[styles.appFooterText, { color: colors.mutedForeground }]}>Offline-first · Expo SDK 53</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: 20, alignItems: "center" },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold" },
  userName: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  userBadge: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  roleChip: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  onDutyPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  onDutyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  onDutyText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  section: { paddingHorizontal: 16, marginTop: 18 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 10 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1 },
  settingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  settingSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  settingValue: { fontSize: 12, fontFamily: "Inter_500Medium" },
  settingBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  settingBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  dutyCta: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  dutyCtaTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  dutyCtaSub: { color: "rgba(255,255,255,0.88)", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  analyticsCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  analyticsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  analyticsCopy: { flex: 1 },
  analyticsTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  analyticsSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  statsRow: { flexDirection: "row", borderRadius: 14, borderWidth: 1, paddingVertical: 16, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  statDivider: { width: 1, height: 36, alignSelf: "center" },
  logoutBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  logoutBtnDisabled: { opacity: 0.75 },
  logoutText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  closureRate: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
  myCasesBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  myCasesIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  myCasesLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  myCasesSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  appFooter: { alignItems: "center", paddingVertical: 20, gap: 3 },
  appFooterText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
