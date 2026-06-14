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
  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
      <View style={styles.hero}><Feather name="settings" size={34} color="#fff" /><Text style={styles.name}>{user?.name}</Text><Text style={styles.role}>{roleLabel}</Text></View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Badge</Text><Text style={[styles.value, { color: colors.text }]}>{user?.badgeNumber}</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Station</Text><Text style={[styles.value, { color: colors.text }]}>{user?.station}</Text>
      </View>
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
  label: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  value: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  logout: { marginHorizontal: 16, height: 50, borderRadius: 14, backgroundColor: "#C0392B", alignItems: "center", justifyContent: "center" },
  logoutText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
