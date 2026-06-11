import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { AGENCIES, useAgency } from "@/context/AgencyContext";
import { AgencyEmblem, AgencyEmblemId } from "@/components/AgencyEmblem";
import { useColors } from "@/hooks/useColors";

const PUBLIC_ACTIONS = [
  { icon: "alert-triangle" as const, label: "Report Stolen Vehicle", route: "/report-theft", color: "#C0392B" },
  { icon: "radio" as const, label: "View Nearby Alerts", route: "/theft-alerts", color: "#8B4513" },
];

export default function AgencySelectScreen() {
  const { user, isLoading } = useAuth();
  const { selectAgency } = useAgency();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (isLoading) return null;

  // Redirect logged-in users straight to their agency interface
  if (user) {
    if (user.agency === "police") return <Redirect href="/(police)" />;
    if (user.agency === "vio") return <Redirect href="/(vio)" />;
    return <Redirect href="/(tabs)" />;
  }

  async function handleAgency(id: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await selectAgency(id);
    router.push("/login");
  }

  async function handlePublic(route: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  }

  return (
    <View style={[styles.root, { backgroundColor: "#0A1628" }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.platformIconWrap}>
            <Feather name="shield" size={36} color="#fff" />
          </View>
          <Text style={styles.appName}>Safety & Security</Text>
          <Text style={styles.appSub}>Integrated Field Operations Platform</Text>
        </View>

        {/* Agency Login Cards */}
        <Text style={styles.sectionLabel}>SELECT YOUR AGENCY</Text>
        <View style={styles.agencyGrid}>
          {AGENCIES.map((agency) => (
            <TouchableOpacity
              key={agency.id}
              style={[styles.agencyCard, { backgroundColor: agency.primaryColor }]}
              onPress={() => handleAgency(agency.id)}
              activeOpacity={0.85}
            >
              <View style={styles.agencyCardInner}>
                <AgencyEmblem agency={agency.id as AgencyEmblemId} size={54} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.agencyShort}>{agency.shortName}</Text>
                  <Text style={styles.agencyFull}>{agency.fullName}</Text>
                  <Text style={styles.agencyDesc}>{agency.description}</Text>
                </View>
              </View>
              <View style={styles.agencyLoginRow}>
                <Text style={styles.agencyLoginText}>Officer Sign In</Text>
                <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>PUBLIC ACCESS</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Public Actions */}
        <View style={styles.publicRow}>
          {PUBLIC_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.route}
              style={[styles.publicBtn, { borderColor: a.color + "55" }]}
              onPress={() => handlePublic(a.route)}
              activeOpacity={0.85}
            >
              <View style={[styles.publicIcon, { backgroundColor: a.color + "22" }]}>
                <Feather name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.publicLabel, { color: "#e8e8e8" }]}>{a.label}</Text>
              <Feather name="chevron-right" size={14} color={a.color} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Official Field Operations System
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { alignItems: "center", marginBottom: 32 },
  platformIconWrap: { width: 72, height: 72, borderRadius: 20, marginBottom: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  appSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 4, textAlign: "center" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, marginBottom: 12 },
  agencyGrid: { gap: 12, marginBottom: 28 },
  agencyCard: { borderRadius: 18, overflow: "hidden" },
  agencyCardInner: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 18, paddingBottom: 10 },
  agencyIconBg: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  agencyShort: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  agencyFull: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)", marginTop: 1 },
  agencyDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 4, lineHeight: 16 },
  agencyLoginRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingHorizontal: 18, paddingBottom: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },
  agencyLoginText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  dividerText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.4)", letterSpacing: 1 },
  publicRow: { gap: 10, marginBottom: 32 },
  publicBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderRadius: 14, padding: 14 },
  publicIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  publicLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  footer: { textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular", ...(Platform.OS !== "web" ? {} : {}) },
});
