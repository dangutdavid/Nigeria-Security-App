import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useInspections } from "@/context/InspectionContext";
import { useReferrals } from "@/context/ReferralContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";
import { confirmAction } from "@/utils/confirm";

const PRIMARY = "#7B3F00";

type MenuItem = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub: string;
  onPress?: () => void;
  destructive?: boolean;
  badge?: number;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
};

export default function VIOProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { inspections } = useInspections();
  const { can, roleLabel } = usePermissions();
  const { pendingCountFor } = useReferrals();
  const { isDark, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const myInspections = inspections.filter((i) => i.inspectedBy === user?.id);
  const myPass = myInspections.filter((i) => i.result === "pass").length;
  const myFail = myInspections.filter((i) => i.result === "fail").length;
  const passRate = myInspections.length > 0 ? Math.round((myPass / myInspections.length) * 100) : 0;
  const pendingReferrals = user ? pendingCountFor(user.agency) : 0;
  const canManageUsers = can("manage_users", "user");

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

  const menuItems: MenuItem[] = [
    { icon: "clipboard", label: "My Inspections", sub: `${myInspections.length} completed`, onPress: () => router.push("/(vio)/inspections" as any) },
    { icon: "award", label: "Certificates", sub: "View all issued certs", onPress: () => router.push("/(vio)/certificates" as any) },
    { icon: "search", label: "Vehicle Lookup", sub: "Check registration and records", onPress: () => router.push("/vehicle-lookup") },
    { icon: "git-pull-request", label: "Referrals", sub: "Cross-agency shared records", badge: pendingReferrals, onPress: () => router.push("/referrals") },
    { icon: "anchor", label: "Duty Log", sub: "Start or review patrol sessions", onPress: () => router.push("/patrol-log") },
    { icon: "bar-chart-2", label: "Analytics", sub: "Inspection trends and pass rates", onPress: () => router.push("/analytics-vio") },
    ...(canManageUsers
      ? [{ icon: "users" as const, label: "Manage Officers", sub: "Create and manage your zone", onPress: () => router.push("/users") }]
      : []),
    { icon: isDark ? "moon" : "sun", label: "Dark Mode", sub: isDark ? "On" : "Off", toggle: true, toggled: isDark, onToggle: toggleTheme },
    { icon: "lock", label: "Change PIN", sub: "Update your security PIN", onPress: () => router.push("/change-pin" as any) },
    { icon: "log-out", label: loggingOut ? "Signing out…" : "Sign Out", sub: "Return to agency selection", onPress: handleLogout, destructive: true },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: PRIMARY }]}>
          <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={styles.avatarText}>{(user?.name ?? "O").split(" ").map((n) => n[0]).join("").slice(0, 2)}</Text>
          </View>
          <Text style={styles.heroName}>{user?.name}</Text>
          <Text style={styles.heroBadge}>{user?.badgeNumber}</Text>
          <View style={[styles.roleChip, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
          <Text style={styles.heroStation}>{user?.station} · {user?.sector}</Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Inspections", value: myInspections.length },
            { label: "Passed", value: myPass },
            { label: "Failed", value: myFail },
            { label: "Pass Rate", value: `${passRate}%` },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Email", value: user?.email },
            { label: "Phone", value: user?.phone },
            { label: "Agency", value: "Vehicle Inspection Officers" },
            { label: "Zone", value: user?.sector },
          ].map((f) => (
            <View key={f.label} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{f.value ?? "—"}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {menuItems.map((m, i) => (
            <TouchableOpacity
              key={m.label}
              style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: i < menuItems.length - 1 ? 1 : 0 }]}
              onPress={m.onPress}
              disabled={m.toggle}
              activeOpacity={m.toggle ? 1 : 0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: m.destructive ? "#FFEBEE" : colors.muted }]}>
                <Feather name={m.icon} size={18} color={m.destructive ? "#E53935" : PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: m.destructive ? "#E53935" : colors.text }]}>{m.label}</Text>
                <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{m.sub}</Text>
              </View>
              {m.toggle ? (
                <Switch
                  value={m.toggled}
                  onValueChange={m.onToggle}
                  trackColor={{ false: colors.border, true: PRIMARY + "88" }}
                  thumbColor={m.toggled ? PRIMARY : colors.mutedForeground}
                />
              ) : (
                <View style={styles.menuRight}>
                  {typeof m.badge === "number" && m.badge > 0 ? (
                    <View style={[styles.badge, { backgroundColor: PRIMARY }]}>
                      <Text style={styles.badgeText}>{m.badge > 99 ? "99+" : m.badge}</Text>
                    </View>
                  ) : null}
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 16 },
  hero: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  heroName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroBadge: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  roleChip: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5 },
  roleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  heroStation: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center" },
  statsRow: { flexDirection: "row", marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  stat: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, marginVertical: 4 },
  infoCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 16 },
  menu: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  menuSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
});
