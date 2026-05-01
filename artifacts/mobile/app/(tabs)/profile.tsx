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
import { useColors } from "@/hooks/useColors";

const ROLE_LABEL: Record<UserRole, string> = {
  field_officer: "Field Officer",
  supervisor: "Supervisor",
  commander: "Operations Commander",
};

const ROLE_COLOR: Record<UserRole, string> = {
  field_officer: "#2C7BE5",
  supervisor: "#C8960C",
  commander: "#1B5E3B",
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
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
  destructive?: boolean;
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
        <Feather
          name={icon as any}
          size={18}
          color={destructive ? colors.fatal : colors.mutedForeground}
        />
      </View>
      <Text
        style={[
          styles.settingLabel,
          { color: destructive ? colors.fatal : colors.text },
        ]}
      >
        {label}
      </Text>
      {value && (
        <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
          {value}
        </Text>
      )}
      {toggle && onToggle ? (
        <Switch
          value={toggled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={toggled ? colors.primary : colors.mutedForeground}
        />
      ) : (
        onPress && (
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        )
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  function handleLogout() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? Any unsynced reports will remain saved locally.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  }

  if (!user) return null;

  const roleColor = ROLE_COLOR[user.role];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primary, paddingTop: topPad + 16 },
        ]}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={styles.avatarText}>
              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </Text>
          </View>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <View style={[styles.roleChip, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text>
        </View>
        <View style={styles.headerInfo}>
          <InfoPill icon="shield" text={user.badgeNumber} />
          <InfoPill icon="map-pin" text={user.station} />
          <InfoPill icon="phone" text={user.phone} />
        </View>
      </View>

      {/* Section: Operations */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          OPERATIONS
        </Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="bar-chart-2"
            label="Analytics & Hotspots"
            onPress={() => router.push("/analytics")}
          />
          <SettingRow
            icon="list"
            label="My Reports"
            onPress={() => router.push("/(tabs)/cases")}
          />
          <SettingRow
            icon="plus-circle"
            label="New Incident Report"
            onPress={() => router.push("/report")}
          />
        </View>
      </View>

      {/* Section: Connectivity */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          CONNECTIVITY
        </Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="cloud-off"
            label="Offline Mode"
            toggle
            toggled={offlineMode}
            onToggle={setOfflineMode}
          />
          <SettingRow
            icon="upload-cloud"
            label="Auto Sync"
            toggle
            toggled={autoSync}
            onToggle={setAutoSync}
          />
          <SettingRow
            icon="map-pin"
            label="Location Sharing"
            toggle
            toggled={locationSharing}
            onToggle={setLocationSharing}
          />
        </View>
      </View>

      {/* Section: Account */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          ACCOUNT
        </Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="user"
            label="Name"
            value={user.name}
          />
          <SettingRow
            icon="shield"
            label="Badge Number"
            value={user.badgeNumber}
          />
          <SettingRow
            icon="briefcase"
            label="Role"
            value={ROLE_LABEL[user.role]}
          />
          <SettingRow
            icon="map-pin"
            label="Sector"
            value={user.sector}
          />
          <SettingRow
            icon="home"
            label="Station"
            value={user.station}
          />
        </View>
      </View>

      {/* Section: App */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          APP
        </Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="info"
            label="Version"
            value="1.0.0"
          />
          <SettingRow
            icon="lock"
            label="Change PIN"
            onPress={() => {}}
          />
        </View>
      </View>

      {/* Sign out */}
      <View style={[styles.section, { marginBottom: 10 }]}>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="log-out"
            label="Sign Out"
            destructive
            onPress={handleLogout}
          />
        </View>
      </View>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        FRSC Field Operations · Authorised Use Only
      </Text>
    </ScrollView>
  );
}

function InfoPill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={pillStyles.pill}>
      <Feather name={icon as any} size={12} color="rgba(255,255,255,0.7)" />
      <Text style={pillStyles.text}>{text}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingBottom: 22,
  },
  avatarWrap: {
    marginBottom: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  roleText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  headerInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  settingValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    maxWidth: 140,
    textAlign: "right",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    paddingVertical: 20,
  },
});
