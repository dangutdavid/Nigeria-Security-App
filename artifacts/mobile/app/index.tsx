import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { routeForUser, useAuth } from "@/context/AuthContext";
import { useAgency } from "@/context/AgencyContext";
import { AgencyEmblem, AgencyEmblemId } from "@/components/AgencyEmblem";
import { useColors } from "@/hooks/useColors";

// Ordered citizen-first: the urgent actions (report, emergency lines, track)
// lead; secondary tools follow.
const PUBLIC_ACTIONS = [
  {
    icon: "edit-3" as const,
    label: "Report Incident",
    route: "/report-incident",
    color: "#0F4C81",
  },
  {
    icon: "life-buoy" as const,
    label: "Emergency Contacts",
    route: "/emergency",
    color: "#D35400",
  },
  {
    icon: "search" as const,
    label: "Track Report",
    route: "/track-report",
    color: "#2E7D52",
  },
  {
    icon: "alert-triangle" as const,
    label: "Report Stolen Vehicle",
    route: "/report-theft",
    color: "#C0392B",
  },
  {
    icon: "radio" as const,
    label: "View Nearby Alerts",
    route: "/theft-alerts",
    color: "#8B4513",
  },
  {
    icon: "message-circle" as const,
    label: "Ask Assistant",
    route: "/assistant",
    color: "#0F4C81",
  },
  {
    icon: "bell" as const,
    label: "Notifications",
    route: "/notifications",
    color: "#0F4C81",
  },
];

export default function AgencySelectScreen() {
  const { user, isLoading } = useAuth();
  const { agencies, selectAgency } = useAgency();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [agencyQuery, setAgencyQuery] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("frsc");

  const activeAgencies = useMemo(() => agencies.filter((agency) => agency.isActive !== false), [agencies]);
  const filteredAgencies = useMemo(() => {
    const q = agencyQuery.trim().toLowerCase();
    if (!q) return activeAgencies;
    return activeAgencies.filter((agency) =>
      `${agency.shortName} ${agency.name} ${agency.fullName} ${agency.description} ${agency.badgePrefix}`
        .toLowerCase()
        .includes(q),
    );
  }, [activeAgencies, agencyQuery]);

  const activeAgency =
    activeAgencies.find((agency) => agency.id === selectedAgencyId) ??
    filteredAgencies[0] ??
    activeAgencies[0];

  if (isLoading) return null;

  // Redirect logged-in users straight to their agency interface
  if (user) {
    return <Redirect href={routeForUser(user) as any} />;
  }

  async function handleAgencySignIn(id: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await selectAgency(id);
    router.push("/login");
  }

  async function handleSelectAgency(id: string) {
    await Haptics.selectionAsync();
    setSelectedAgencyId(id);
  }

  async function handlePublic(route: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  }

  return (
    <View style={[styles.root, { backgroundColor: "#0A1628" }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.platformIconWrap}>
            <Feather name="shield" size={36} color="#fff" />
          </View>
          <Text style={styles.appName}>Safety & Security</Text>
          <Text style={styles.appSub}>
            Integrated Field Operations Platform
          </Text>
        </View>

        {/* Public access first: citizens reporting an emergency are the most
            time-critical users and must not scroll past the agency list. */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>NEED HELP? PUBLIC ACCESS</Text>
        </View>
        <View style={styles.publicRow}>
          {PUBLIC_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.route}
              style={[styles.publicBtn, { borderColor: a.color + "55" }]}
              onPress={() => handlePublic(a.route)}
              activeOpacity={0.85}
            >
              <View
                style={[styles.publicIcon, { backgroundColor: a.color + "22" }]}
              >
                <Feather name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.publicLabel, { color: "#e8e8e8" }]}>
                {a.label}
              </Text>
              <Feather name="chevron-right" size={14} color={a.color} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>AGENCY SIGN IN</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Agency Login */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>SELECT YOUR AGENCY</Text>
          <Text style={styles.agencyCount}>{activeAgencies.length} active agencies</Text>
        </View>
        <View style={styles.agencySelector}>
          <View style={styles.agencySearch}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.55)" />
            <TextInput
              value={agencyQuery}
              onChangeText={setAgencyQuery}
              placeholder="Search agency, role, mandate..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.agencySearchInput}
              autoCorrect={false}
            />
            {agencyQuery ? (
              <TouchableOpacity onPress={() => setAgencyQuery("")}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.agencyList}>
            {filteredAgencies.map((agency) => {
              const active = activeAgency?.id === agency.id;
              return (
                <TouchableOpacity
                  key={agency.id}
                  style={[
                    styles.agencyRow,
                    {
                      borderColor: active ? agency.primaryColor : "rgba(255,255,255,0.1)",
                      backgroundColor: active ? agency.primaryColor + "26" : "rgba(255,255,255,0.055)",
                    },
                  ]}
                  onPress={() => handleSelectAgency(agency.id)}
                  activeOpacity={0.86}
                >
                  <AgencyEmblem agency={agency.id as AgencyEmblemId} size={38} color={agency.primaryColor} label={agency.shortName} />
                  <View style={styles.agencyRowText}>
                    <Text style={styles.agencyShort}>{agency.shortName}</Text>
                    <Text style={styles.agencyFull} numberOfLines={1}>{agency.fullName}</Text>
                  </View>
                  {active ? (
                    <View style={[styles.selectedDot, { backgroundColor: agency.primaryColor }]}>
                      <Feather name="check" size={13} color="#fff" />
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.35)" />
                  )}
                </TouchableOpacity>
              );
            })}
            {filteredAgencies.length === 0 && (
              <View style={styles.emptyAgency}>
                <Feather name="search" size={18} color="rgba(255,255,255,0.45)" />
                <Text style={styles.emptyAgencyText}>No agency matches your search.</Text>
              </View>
            )}
          </View>

          {activeAgency ? (
            <View style={[styles.selectedAgencyPanel, { borderColor: activeAgency.primaryColor + "66" }]}>
              <View style={styles.selectedAgencyTop}>
                <AgencyEmblem agency={activeAgency.id as AgencyEmblemId} size={50} color={activeAgency.primaryColor} label={activeAgency.shortName} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedAgencyName}>{activeAgency.shortName}</Text>
                  <Text style={styles.selectedAgencyFull}>{activeAgency.fullName}</Text>
                </View>
              </View>
              <Text style={styles.selectedAgencyDesc}>{activeAgency.description}</Text>
              <TouchableOpacity
                style={[styles.agencyLoginBtn, { backgroundColor: activeAgency.primaryColor }]}
                onPress={() => handleAgencySignIn(activeAgency.id)}
                activeOpacity={0.88}
              >
                <Text style={styles.agencyLoginText}>Officer Sign In</Text>
                <Feather name="arrow-right" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
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
  platformIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  appSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 4,
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1.5,
  },
  agencyCount: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
  },
  agencySelector: {
    gap: 12,
    marginBottom: 28,
  },
  agencySearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.065)",
    paddingHorizontal: 13,
  },
  agencySearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  agencyList: { gap: 8 },
  agencyRow: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  agencyRowText: { flex: 1, minWidth: 0 },
  agencyShort: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  agencyFull: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  selectedDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAgency: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyAgencyText: { color: "rgba(255,255,255,0.58)", fontSize: 13, fontFamily: "Inter_500Medium" },
  selectedAgencyPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.075)",
  },
  selectedAgencyTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  selectedAgencyName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  selectedAgencyFull: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  selectedAgencyDesc: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 17,
  },
  agencyLoginBtn: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  agencyLoginText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
  },
  publicRow: { gap: 10, marginBottom: 32 },
  publicBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  publicIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  publicLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    ...(Platform.OS !== "web" ? {} : {}),
  },
});
