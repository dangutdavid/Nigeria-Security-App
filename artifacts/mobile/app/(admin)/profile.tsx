import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";

export default function AdminProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { roleLabel } = usePermissions();
  const tools: { icon: keyof typeof Feather.glyphMap; title: string; sub: string; route: string }[] = [
    { icon: "bar-chart-2", title: "Manage Agencies", sub: "Agency workload, add agency, activate / deactivate", route: "/(admin)/agencies" },
    { icon: "users", title: "Manage Users", sub: "Onboard and suspend agency users", route: "/(admin)/users" },
    { icon: "git-pull-request", title: "Referrals", sub: "Cross-agency report referrals", route: "/(admin)/referrals" },
    { icon: "activity", title: "Audit Log", sub: "Security-sensitive activity trail", route: "/(admin)/audit" },
  ];

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}><Feather name="settings" size={34} color="#fff" /><Text style={styles.name}>{user?.name}</Text><Text style={styles.role}>{roleLabel}</Text></View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Badge</Text><Text style={[styles.value, { color: colors.text }]}>{user?.badgeNumber}</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Station</Text><Text style={[styles.value, { color: colors.text }]}>{user?.station}</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ADMIN TOOLS</Text>
      <View style={styles.toolsCard}>
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.route}
            style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(tool.route as any)}
            activeOpacity={0.84}
          >
            <View style={styles.toolIcon}><Feather name={tool.icon} size={18} color="#344054" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toolTitle, { color: colors.text }]}>{tool.title}</Text>
              <Text style={[styles.toolSub, { color: colors.mutedForeground }]}>{tool.sub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.notificationBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push("/notifications" as any)}>
        <Feather name="bell" size={17} color="#344054" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.notificationTitle, { color: colors.text }]}>Notifications</Text>
          <Text style={[styles.notificationSub, { color: colors.mutedForeground }]}>Admin alerts and local preferences</Text>
        </View>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.logout} onPress={() => router.replace("/logout")}><Text style={styles.logoutText}>Sign Out</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { backgroundColor: "#344054", alignItems: "center", padding: 28 },
  name: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 10, textAlign: "center" },
  role: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 16, margin: 16, padding: 16, gap: 6 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5, marginHorizontal: 16, marginBottom: 8 },
  toolsCard: { marginHorizontal: 16, marginBottom: 16, gap: 10 },
  toolBtn: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  toolIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#34405412", alignItems: "center", justifyContent: "center" },
  toolTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  toolSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  notificationBtn: { borderWidth: 1, borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  notificationTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  notificationSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  value: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  logout: { marginHorizontal: 16, height: 50, borderRadius: 14, backgroundColor: "#C0392B", alignItems: "center", justifyContent: "center" },
  logoutText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
