import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { ToolBackHeader } from "@/components/ToolBackHeader";
import { useAgency } from "@/context/AgencyContext";
import { User, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { roleLabel } from "@/lib/permissions";
import * as userRepo from "@/services/userRepository";

export default function AdminUsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agencies } = useAgency();
  const { allUsers, updateUser, deleteUser, resetPin, mergeApiUsers } = useAuth();

  // Local adapter the repository falls back to (and merges API users into).
  const adapter = useMemo<userRepo.UserRepositoryLocalAdapter>(
    () => ({
      list: () => allUsers,
      merge: mergeApiUsers,
      create: async () => {},
      update: updateUser,
      remove: deleteUser,
      resetPin,
    }),
    [allUsers, mergeApiUsers, updateUser, deleteUser, resetPin],
  );

  // Load through the repository: backend users in API mode (merged in for
  // display/edit), local users otherwise. Refresh whenever the screen focuses.
  useFocusEffect(
    useCallback(() => {
      void userRepo.listUsers(adapter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mergeApiUsers]),
  );

  const grouped = useMemo(
    () => agencies.map((agency) => ({ agency, users: allUsers.filter((u) => u.agency === agency.id) })),
    [agencies, allUsers],
  );

  async function updateStatus(user: User, status: User["status"]) {
    if (status === "active") await userRepo.reactivateUser(user.id, adapter);
    else await userRepo.deactivateUser(user.id, adapter);
    // Re-sync from the backend (API mode) so the new status is reflected.
    void userRepo.listUsers(adapter);
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}>
      <ToolBackHeader title="Admin Tools" />
      <Text style={[styles.title, { color: colors.text }]}>Users</Text>
      {grouped.map((group) => (
        <View key={group.agency.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAgency}>
              <AgencyEmblem agency={group.agency.id} size={34} color={group.agency.primaryColor} label={group.agency.shortName} />
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{group.agency.shortName}</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{group.users.length} user{group.users.length === 1 ? "" : "s"}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: group.agency.primaryColor }]} onPress={() => router.push(`/user-form?agency=${group.agency.id}` as any)}>
              <Feather name="user-plus" size={14} color="#fff" />
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
          </View>
          {group.users.map((user) => <UserCard key={user.id} user={user} onStatus={updateStatus} />)}
          {group.users.length === 0 && <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users onboarded yet.</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

function UserCard({ user, onStatus }: { user: User; onStatus: (user: User, status: User["status"]) => Promise<void> }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><Feather name="user" size={16} color="#344054" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.meta}>{user.badgeNumber} · {roleLabel(user.agency, user.role)} · {user.status}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => onStatus(user, "active")}><Text style={styles.actionText}>Activate</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => onStatus(user, "suspended")}><Text style={styles.actionText}>Suspend</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  section: { marginBottom: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionAgency: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  addText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_600SemiBold", padding: 12 },
  card: { backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#34405412", alignItems: "center", justifyContent: "center" },
  name: { color: "#111827", fontSize: 14, fontFamily: "Inter_700Bold" },
  meta: { color: "#6B7280", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  actions: { gap: 5 },
  action: { backgroundColor: "#34405412", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  actionText: { color: "#344054", fontSize: 10, fontFamily: "Inter_700Bold" },
});
