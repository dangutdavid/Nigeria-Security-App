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
      router.replace("/(tabs)/");
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
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.logoArea}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
          />
          <Text style={styles.appName}>FRSC Mobile</Text>
          <Text style={styles.appSub}>Federal Road Safety Corps</Text>
          <Text style={styles.appSub2}>Field Operations System</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Officer Sign In
          </Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Use your FRSC badge number and assigned PIN
          </Text>

          {/* Badge input */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Badge Number
            </Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: colors.border, backgroundColor: colors.muted },
              ]}
            >
              <Feather name="shield" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. FO-001"
                placeholderTextColor={colors.mutedForeground}
                value={badge}
                onChangeText={(t) => {
                  setBadge(t);
                  setError("");
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* PIN input */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              PIN
            </Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: colors.border, backgroundColor: colors.muted },
              ]}
            >
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your PIN"
                placeholderTextColor={colors.mutedForeground}
                value={pin}
                onChangeText={(t) => {
                  setPin(t);
                  setError("");
                }}
                secureTextEntry={!showPin}
                keyboardType="number-pad"
              />
              <TouchableOpacity onPress={() => setShowPin((s) => !s)}>
                <Feather
                  name={showPin ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.fatalLight, borderColor: colors.fatal },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.fatal} />
              <Text style={[styles.errorText, { color: colors.fatal }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.loginBtn,
              { backgroundColor: colors.primary },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={styles.loginBtnText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Demo hints */}
          <View style={[styles.demoSection, { borderTopColor: colors.border }]}>
            <Text
              style={[styles.demoTitle, { color: colors.mutedForeground }]}
            >
              Demo Accounts
            </Text>
            <View style={styles.demoList}>
              {DEMO_HINTS.map((d) => (
                <TouchableOpacity
                  key={d.badge}
                  style={[
                    styles.demoChip,
                    { borderColor: colors.border, backgroundColor: colors.muted },
                  ]}
                  onPress={() => fillDemo(d.badge, d.pin)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.demoChipBadge, { color: colors.primary }]}>
                    {d.badge}
                  </Text>
                  <Text
                    style={[styles.demoChipRole, { color: colors.mutedForeground }]}
                  >
                    {d.role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) },
          ]}
        >
          FRSC Field Operations v1.0 — Authorised Use Only
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 12,
  },
  appName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  appSub: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  appSub2: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 22,
    lineHeight: 18,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 15,
    borderRadius: 12,
    marginTop: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  demoSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
  },
  demoTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  demoList: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  demoChip: {
    flex: 1,
    minWidth: 90,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  demoChipBadge: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  demoChipRole: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  footer: {
    textAlign: "center",
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginTop: 24,
    fontFamily: "Inter_400Regular",
  },
});
