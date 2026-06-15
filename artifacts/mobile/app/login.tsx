import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgencyType, routeForUser, useAuth } from "@/context/AuthContext";
import { useAgency } from "@/context/AgencyContext";
import { AgencyEmblem, AgencyEmblemId } from "@/components/AgencyEmblem";
import { useColors } from "@/hooks/useColors";

const DEMO_HINTS: Record<string, { badge: string; pin: string; role: string }[]> = {
  frsc: [
    { badge: "FO-001", pin: "1234", role: "Field Officer" },
    { badge: "SV-042", pin: "1234", role: "Supervisor" },
    { badge: "CMD-007", pin: "1234", role: "Commander" },
  ],
  police: [
    { badge: "NPF-001", pin: "1234", role: "Inspector" },
    { badge: "NPF-042", pin: "1234", role: "DSP (Supervisor)" },
    { badge: "NPF-CMD", pin: "1234", role: "ACP (Commander)" },
  ],
  vio: [
    { badge: "VIO-001", pin: "1234", role: "Inspection Officer" },
    { badge: "VIO-SV2", pin: "1234", role: "Senior Inspector" },
    { badge: "VIO-CMD", pin: "1234", role: "Director" },
  ],
  civil_defence: [
    { badge: "NSCDC-001", pin: "1234", role: "Civil Defence Officer" },
    { badge: "NSCDC-SV", pin: "1234", role: "Supervisor" },
    { badge: "NSCDC-CMD", pin: "1234", role: "Commandant" },
  ],
  admin: [
    { badge: "ADMIN-001", pin: "1234", role: "Admin" },
    { badge: "SUPER-001", pin: "1234", role: "Super Admin" },
  ],
};

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { allUsers, login } = useAuth();
  const { selectedAgency, clearAgency } = useAgency();

  const [badge, setBadge] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const agencyId = selectedAgency?.id ?? "frsc";
  const primaryColor = selectedAgency?.primaryColor ?? "#1B5E3B";
  const hints = useMemo(() => {
    const dynamicHints = allUsers
      .filter((candidate) => candidate.agency === agencyId && candidate.status === "active")
      .slice(0, 3)
      .map((candidate) => ({
        badge: candidate.badgeNumber,
        pin: "1234",
        role: labelForRole(candidate.role),
      }));
    return dynamicHints.length > 0 ? dynamicHints : DEMO_HINTS[agencyId] ?? DEMO_HINTS.frsc;
  }, [agencyId, allUsers]);

  async function handleLogin() {
    if (!badge.trim() || !pin.trim()) {
      setError("Please enter your badge number and PIN.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await login(badge.trim(), pin.trim(), agencyId as AgencyType);
    setLoading(false);
    if (result === "ok") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const signedInUser = allUsers.find(
        (candidate) =>
          candidate.badgeNumber.toUpperCase() === badge.trim().toUpperCase() &&
          candidate.agency === agencyId,
      );
      const route = routeForUser(signedInUser);
      router.replace(route as any);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (result === "inactive") {
        setError("This account is inactive. Contact your supervisor.");
      } else if (result === "suspended") {
        setError("This account has been suspended. Contact your supervisor.");
      } else {
        setError("Invalid badge number or PIN. Please try again.");
      }
    }
  }

  function fillDemo(b: string, p: string) {
    setBadge(b);
    setPin(p);
    setError("");
  }

  async function handleBack() {
    await clearAgency();
    router.back();
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: primaryColor }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backText}>All Agencies</Text>
        </TouchableOpacity>

        {/* Agency identity */}
        <View style={styles.logoArea}>
          <AgencyEmblem agency={(agencyId as AgencyEmblemId) ?? "frsc"} size={90} />
          <Text style={styles.agencyName}>{selectedAgency?.shortName ?? "FRSC"}</Text>
          <Text style={styles.agencyFull}>{selectedAgency?.fullName ?? "Federal Road Safety Corps"}</Text>
          <Text style={styles.appSub2}>Field Operations System</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Officer Sign In</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Enter your badge number and PIN to continue.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Badge Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
              value={badge}
              onChangeText={(t) => { setBadge(t); setError(""); }}
              placeholder="e.g. FO-001"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>PIN</Text>
            <View style={styles.pinRow}>
              <TextInput
                style={[styles.input, styles.pinInput, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
                value={pin}
                onChangeText={(t) => { setPin(t); setError(""); }}
                placeholder="••••"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                secureTextEntry={!showPin}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={[styles.eyeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => setShowPin((v) => !v)}>
                <Feather name={showPin ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: primaryColor }, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.loginBtnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/forgot-pin")} style={styles.forgotBtn}>
            <Text style={[styles.forgotText, { color: primaryColor }]}>Forgot PIN?</Text>
          </TouchableOpacity>
        </View>

        {/* Demo hints */}
        <View style={[styles.demoBox, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
          <Text style={styles.demoTitle}>Demo Accounts (PIN: 1234)</Text>
          {hints.map((h) => (
            <TouchableOpacity key={h.badge} style={styles.demoRow} onPress={() => fillDemo(h.badge, h.pin)}>
              <View style={[styles.demoIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                <Feather name="user" size={13} color="#fff" />
              </View>
              <Text style={styles.demoText}>{h.badge}</Text>
              <Text style={styles.demoRole}>{h.role}</Text>
              <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function labelForRole(role: string) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "commander":
      return "Commander";
    case "supervisor":
      return "Supervisor";
    case "officer":
      return "Officer";
    default:
      return "User";
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  logoArea: { alignItems: "center", marginBottom: 28 },
  agencyName: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 12 },
  agencyFull: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", marginTop: 2, textAlign: "center" },
  appSub2: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", marginTop: 4 },
  card: { borderRadius: 20, padding: 22, marginBottom: 20 },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  cardSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 20 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  pinRow: { flexDirection: "row", gap: 10 },
  pinInput: { flex: 1 },
  eyeBtn: { width: 48, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#E53935", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12, textAlign: "center" },
  loginBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 4 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  forgotBtn: { alignItems: "center", marginTop: 14 },
  forgotText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  demoBox: { borderRadius: 16, padding: 16, gap: 10 },
  demoTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  demoIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  demoText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", flex: 1 },
  demoRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
});
