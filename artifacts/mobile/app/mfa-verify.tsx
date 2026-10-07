import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { routeForUser, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { MfaMethod } from "@/services/authRepository";

const LABELS: Record<MfaMethod, { title: string; hint: string; icon: keyof typeof Feather.glyphMap }> = {
  totp: { title: "Authenticator app", hint: "Enter the 6-digit code from your authenticator app.", icon: "smartphone" },
  sms: { title: "Text message", hint: "We'll text a 6-digit code to your phone.", icon: "message-square" },
  recovery: { title: "Recovery code", hint: "Enter one of your saved recovery codes (e.g. ABCD-EFGH). Each works once.", icon: "key" },
};

export default function MfaVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pendingMfa, completeMfaLogin, sendMfaSmsCode, cancelMfa } = useAuth();

  const methods = pendingMfa?.methods ?? [];
  const [method, setMethod] = useState<MfaMethod>(methods.includes("totp") ? "totp" : methods[0] ?? "totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [smsInfo, setSmsInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!pendingMfa) router.replace("/" as never);
  }, [pendingMfa, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function sendSms() {
    setError("");
    setBusy(true);
    const res = await sendMfaSmsCode();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCooldown(60);
    setSmsInfo(`Code sent to ${res.maskedPhone}.${res.devCode ? ` (Development code: ${res.devCode})` : ""}`);
  }

  async function submit() {
    const value = code.trim();
    if (method === "recovery" ? value.replace(/[^A-Za-z0-9]/g, "").length < 8 : !/^\d{6}$/.test(value)) {
      setError(method === "recovery" ? "Enter a full recovery code." : "Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await completeMfaLogin(method, value);
    setBusy(false);
    if (!res.ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error);
      setCode("");
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(routeForUser(res.user) as never);
  }

  function back() {
    cancelMfa();
    router.back();
  }

  const label = LABELS[method];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24) }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={back} style={styles.back} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back to sign in</Text>
        </TouchableOpacity>

        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Feather name="shield" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Two-step verification</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your PIN was accepted. Confirm it's you to finish signing in as {pendingMfa?.badgeNumber}.
        </Text>

        {methods.length > 1 && (
          <View style={styles.tabs}>
            {methods.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  setMethod(m);
                  setCode("");
                  setError("");
                }}
                style={[styles.tab, { borderColor: method === m ? colors.primary : colors.border, backgroundColor: method === m ? colors.muted : colors.card }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: method === m }}
              >
                <Feather name={LABELS[m].icon} size={16} color={method === m ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.tabText, { color: method === m ? colors.primary : colors.mutedForeground }]}>{LABELS[m].title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {method === "sms" && pendingMfa?.smsMaskedPhone ? `We'll text a 6-digit code to ${pendingMfa.smsMaskedPhone}.` : label.hint}
          </Text>

          {method === "sms" && (
            <TouchableOpacity
              onPress={sendSms}
              disabled={busy || cooldown > 0}
              style={[styles.secondaryBtn, { borderColor: colors.primary, opacity: busy || cooldown > 0 ? 0.5 : 1 }]}
            >
              <Text style={[styles.secondaryText, { color: colors.primary }]}>{cooldown > 0 ? `Resend in ${cooldown}s` : smsInfo ? "Resend code" : "Send code"}</Text>
            </TouchableOpacity>
          )}
          {smsInfo !== "" && method === "sms" && <Text style={[styles.info, { color: colors.success }]}>{smsInfo}</Text>}

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={method === "recovery" ? "ABCD-EFGH" : "123456"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType={method === "recovery" ? "default" : "number-pad"}
            autoCapitalize="characters"
            autoComplete={method === "recovery" ? "off" : "one-time-code"}
            textContentType="oneTimeCode"
            maxLength={method === "recovery" ? 12 : 6}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            accessibilityLabel={label.title + " code"}
            onSubmitEditing={submit}
          />

          {error !== "" && <Text style={[styles.error, { color: colors.fatal }]}>{error}</Text>}

          <TouchableOpacity onPress={submit} disabled={busy} style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify and sign in</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Lost access to every method? Ask an administrator to reset your two-step verification.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8, marginBottom: 20, lineHeight: 20 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  hint: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  info: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 14, fontSize: 22, letterSpacing: 6, textAlign: "center", fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 13, fontFamily: "Inter_500Medium" },
  primaryBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1 },
  secondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 20, lineHeight: 18 },
});
