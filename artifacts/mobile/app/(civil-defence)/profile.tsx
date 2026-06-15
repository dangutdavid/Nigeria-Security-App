import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAgencyBrand } from "@/context/AgencyContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";

export default function CivilDefenceProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { roleLabel, canCustomizeOwnAgency } = usePermissions();
  const { primary: PRIMARY } = useAgencyBrand("civil_defence", { primary: "#234E2A" });

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
      <View style={[styles.hero, { backgroundColor: PRIMARY }]}>
        <View style={styles.avatar}><Feather name="shield" size={30} color={PRIMARY} /></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>{roleLabel}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Info label="Badge" value={user?.badgeNumber ?? "-"} />
        <Info label="Sector" value={user?.sector ?? "-"} />
        <Info label="Station" value={user?.station ?? "-"} />
        <Info label="Phone" value={user?.phone ?? "-"} />
      </View>
      <TouchableOpacity style={[styles.notificationBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push("/notifications" as any)}>
        <Feather name="bell" size={17} color={PRIMARY} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.notificationTitle, { color: colors.text }]}>Notifications</Text>
          <Text style={[styles.notificationSub, { color: colors.mutedForeground }]}>Alerts and local preferences</Text>
        </View>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </TouchableOpacity>
      {canCustomizeOwnAgency ? (
        <TouchableOpacity style={[styles.notificationBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push("/agency-customize" as any)}>
          <Feather name="edit-2" size={17} color={PRIMARY} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.notificationTitle, { color: colors.text }]}>Customise Agency</Text>
            <Text style={[styles.notificationSub, { color: colors.mutedForeground }]}>Theme colours and logo</Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace("/logout")}>
        <Feather name="log-out" size={17} color="#fff" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { backgroundColor: "#234E2A", padding: 24, alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  name: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 12, textAlign: "center" },
  role: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 16, margin: 16, padding: 16, gap: 12 },
  notificationBtn: { borderWidth: 1, borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  notificationTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  notificationSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  infoRow: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)", paddingBottom: 10 },
  infoLabel: { color: "#6B7280", fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  infoValue: { color: "#111827", fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  logoutBtn: { marginHorizontal: 16, height: 50, borderRadius: 14, backgroundColor: "#C0392B", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
