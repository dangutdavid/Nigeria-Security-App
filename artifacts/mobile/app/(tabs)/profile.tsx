import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, UserRole } from "@/context/AuthContext";
import { usePatrol } from "@/context/PatrolContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

const ROLE_LABEL: Record<UserRole, string> = {
  field_officer: "Field Officer",
  supervisor: "Supervisor",
  commander: "Operations Commander",
};

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
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { isOnDuty, activeSession } = usePatrol();

  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  async function doLogout() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOfflineMode(false);
    setAutoSync(true);
    setLocationSharing(true);
    await logout();
    router.replace("/");
  }

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void doLogout().catch(() => {
            Alert.alert("Sign Out Failed", "Please try again.");
          });
        },
      },
    ]);
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
        <View style={[styles.roleChip, { backgroundColor: "rgba(255,255,255,0.15)" }]}> 
          <Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text>
        </View>
      </View>

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
          <SettingRow icon="briefcase" label="Role" value={ROLE_LABEL[user.role]} />
          <SettingRow icon="mail" label="Email" value={user.email || "—"} />
          <SettingRow icon="map-pin" label="Station" value={user.station} />
          <SettingRow icon="phone" label="Phone" value={user.phone} />
          <SettingRow icon="users" label="Manage Users" onPress={() => router.push("/users")} />
          <SettingRow icon="key" label="Change PIN" onPress={() => router.push("/change-pin")} />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.fatal }]} onPress={handleLogout} activeOpacity={0.85}>
          <Feather name="log-out" size={16} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
  roleChip: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  section: { paddingHorizontal: 16, marginTop: 18 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 10 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1 },
  settingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  settingSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  settingValue: { fontSize: 12, fontFamily: "Inter_500Medium" },
  logoutBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  logoutText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});