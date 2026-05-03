import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const DEMO_HINTS = [
  { badge: "FO-001", pin: "1234", role: "Field Officer" },
  { badge: "SV-042", pin: "1234", role: "Supervisor" },
  { badge: "CMD-007", pin: "1234", role: "Commander" },
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [badge, setBadge] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!badge.trim() || !pin.trim()) {
      setError("Please enter your badge number and PIN.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await login(badge.trim(), pin.trim());
    setLoading(false);
    if (result === "ok") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (result === "inactive") {
        setError("This account is inactive. Contact your commander.");
      } else if (result === "suspended") {
        setError("This account has been suspended. Contact your commander.");
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

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.primary }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.logoArea}>
          <Image source={require("../assets/images/icon.png")} style={styles.logo} />
          <Text style={styles.appName}>FRSC Mobile</Text>
          <Text style={styles.appSub}>Federal Road Safety Corps</Text>
          <Text style={styles.appSub2}>Field Operations System</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Officer Sign In</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Use your FRSC badge number and assigned PIN</Text>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Badge Number</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Feather name="shield" size={18} color={colors.mutedForeground} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="e.g. FO-001" placeholderTextColor={colors.mutedForeground} value={badge} onChangeText={(t) => { setBadge(t); setError(""); }} autoCapitalize="characters" autoCorrect={false} />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>PIN</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Enter your PIN" placeholderTextColor={colors.mutedForeground} value={pin} onChangeText={(t) => { setPin(t); setError(""); }} secureTextEntry={!showPin} keyboardType="number-pad" />
              <TouchableOpacity onPress={() => setShowPin((s) => !s)}>
                <Feather name={showPin ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.fatalLight, borderColor: colors.fatal }]}>
              <Feather name="alert-circle" size={14} color={colors.fatal} />
              <Text style={[styles.errorText, { color: colors.fatal }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.loginBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : (<><Feather name="log-in" size={18} color="#fff" /><Text style={styles.loginBtnText}>Sign In</Text></>)}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/forgot-pin")} style={styles.forgotLink} activeOpacity={0.7}>
            <Feather name="help-circle" size={14} color={colors.mutedForeground} />
            <Text style={[styles.forgotLinkText, { color: colors.mutedForeground }]}>Forgot your PIN?</Text>
          </TouchableOpacity>

          <View style={[styles.demoSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.demoTitle, { color: colors.mutedForeground }]}>Demo Accounts</Text>
            <View style={styles.demoList}>
              {DEMO_HINTS.map((d) => (
                <TouchableOpacity key={d.badge} style={[styles.demoChip, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={() => fillDemo(d.badge, d.pin)} activeOpacity={0.7}>
                  <Text style={[styles.demoChipBadge, { color: colors.primary }]}>{d.badge}</Text>
                  <Text style={[styles.demoChipRole, { color: colors.mutedForeground }]}>{d.role}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  logoArea: { alignItems: "center", marginBottom: 24 },
  logo: { width: 86, height: 86, marginBottom: 14 },
  appName: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  appSub: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  appSub2: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  card: { borderRadius: 24, padding: 20 },
  cardTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6, marginBottom: 20 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  loginBtn: { marginTop: 4, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  loginBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  forgotLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  forgotLinkText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  demoSection: { marginTop: 18, paddingTop: 16, borderTopWidth: 1 },
  demoTitle: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 10, textTransform: "uppercase" },
  demoList: { gap: 10 },
  demoChip: { borderWidth: 1, borderRadius: 14, padding: 12 },
  demoChipBadge: { fontSize: 14, fontFamily: "Inter_700Bold" },
  demoChipRole: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
