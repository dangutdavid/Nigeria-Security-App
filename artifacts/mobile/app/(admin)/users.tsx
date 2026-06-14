import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyType, User, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { roleLabel } from "@/lib/permissions";

const AGENCIES: AgencyType[] = ["frsc", "police", "vio", "civil_defence", "admin"];

export default function AdminUsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { allUsers } = useAuth();
  const grouped = useMemo(() => AGENCIES.map((agency) => ({ agency, users: allUsers.filter((u) => u.agency === agency) })), [allUsers]);
  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}>
      <Text style={[styles.title, { color: colors.text }]}>Users</Text>
      {grouped.map((group) => (
        <View key={group.agency} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{group.agency.replace("_", " ").toUpperCase()}</Text>
          {group.users.map((user) => <UserCard key={user.id} user={user} />)}
        </View>
      ))}
    </ScrollView>
  );
}

function UserCard({ user }: { user: User }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><Feather name="user" size={16} color="#344054" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.meta}>{user.badgeNumber} · {roleLabel(user.agency, user.role)}</Text>
      </View>
      <View style={styles.actions}><TouchableOpacity style={styles.action}><Text style={styles.actionText}>Activate</Text></TouchableOpacity><TouchableOpacity style={styles.action}><Text style={styles.actionText}>Suspend</Text></TouchableOpacity></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8 },
  card: { backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#34405412", alignItems: "center", justifyContent: "center" },
  name: { color: "#111827", fontSize: 14, fontFamily: "Inter_700Bold" },
  meta: { color: "#6B7280", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  actions: { gap: 5 },
  action: { backgroundColor: "#34405412", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  actionText: { color: "#344054", fontSize: 10, fontFamily: "Inter_700Bold" },
});
