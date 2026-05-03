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
import { useTheme } from "@/context/ThemeContext";
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

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
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
      </View>

      {/* Section: Appearance */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon={isDark ? "moon" : "sun"}
            label="Theme"
            subtitle={isDark ? "Dark mode on" : "Light mode on"}
            toggle
            toggled={isDark}
            onToggle={toggleTheme}
          />
        </View>
      </View>

      {/* Section: Connectivity */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONNECTIVITY</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>...
