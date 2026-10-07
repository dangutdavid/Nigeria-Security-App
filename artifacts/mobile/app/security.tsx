import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QrCode } from "@/components/QrCode";
import { routeForUser, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { shouldUseApi } from "@/services/apiConfig";
import {
  confirmSmsSetup,
  confirmTotpSetup,
  disableMfaMethod,
  getMfaStatus,
  regenerateRecoveryCodes,
  startSmsSetup,
  startTotpSetup,
  type MfaStatus,
} from "@/services/mfaRepository";

type Flow =
  | { kind: "none" }
  | { kind: "totp"; secret: string; uri: string }
  | { kind: "sms-phone" }
  | { kind: "sms-code"; maskedPhone: string; devCode?: string }
  | { kind: "disable"; method: "totp" | "sms" };

export default function SecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, mfaEnrollmentRequired, markMfaEnrolled } = useAuth();

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flow, setFlow] = useState<Flow>({ kind: "none" });
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [proofMethod, setProofMethod] = useState<"totp" | "recovery">("totp");
  // True when this visit is the mandatory first-time setup after sign-in.
  const [finishingRequiredSetup, setFinishingRequiredSetup] = useState(false);

  function goHome() {
    if (user) router.replace(routeForUser(user) as never);
  }

  const online = shouldUseApi();

  const refresh = useCallback(async () => {
    if (!online) {
      setLoading(false);
      return;
    }
    const res = await getMfaStatus();
    setLoading(false);
    if (res.ok) setStatus(res.data);
    else setError(res.error);
  }, [online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetFlow() {
    setFlow({ kind: "none" });
    setCode("");
    setError("");
  }

  async function enrolmentDone(next: MfaStatus, codes?: string[]) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStatus(next);
    resetFlow();
    if (mfaEnrollmentRequired) {
      markMfaEnrolled();
      if (!codes) return goHome(); // nothing left to show — continue into the app
      setFinishingRequiredSetup(true);
    }
    if (codes) setRecoveryCodes(codes);
  }

  async function beginTotp() {
    setBusy(true);
    setError("");
    const res = await startTotpSetup();
    setBusy(false);
    if (res.ok) setFlow({ kind: "totp", secret: res.data.secret, uri: res.data.otpauthUri });
    else setError(res.error);
  }

  async function confirmTotp() {
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code shown in your authenticator app.");
    setBusy(true);
    const res = await confirmTotpSetup(code.trim());
    setBusy(false);
    if (res.ok) await enrolmentDone(res.data.status, res.data.recoveryCodes);
    else setError(res.error);
  }

  async function sendSmsCode() {
    setBusy(true);
    setError("");
    const res = await startSmsSetup(phone.trim());
    setBusy(false);
    if (res.ok) setFlow({ kind: "sms-code", maskedPhone: res.data.maskedPhone, devCode: res.data.devCode });
    else setError(res.error);
  }

  async function confirmSms() {
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code we texted you.");
    setBusy(true);
    const res = await confirmSmsSetup(code.trim());
    setBusy(false);
    if (res.ok) await enrolmentDone(res.data.status, res.data.recoveryCodes);
    else setError(res.error);
  }

  async function confirmDisable(method: "totp" | "sms") {
    setBusy(true);
    const res = await disableMfaMethod(method, proofMethod, code.trim());
    setBusy(false);
    if (res.ok) {
      setStatus(res.data.status);
      resetFlow();
    } else setError(res.error);
  }

  async function newRecoveryCodes() {
    setBusy(true);
    const res = await regenerateRecoveryCodes();
    setBusy(false);
    if (res.ok) setRecoveryCodes(res.data.recoveryCodes);
    else Alert.alert("Recovery codes", res.error);
  }

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]} keyboardShouldPersistTaps="handled">
      {!mfaEnrollmentRequired && (
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.title, { color: colors.text }]}>Two-step verification</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Protect your account with a second step after your PIN: a code from an authenticator app or a text message.
      </Text>

      {mfaEnrollmentRequired && (
        <View style={[styles.banner, { backgroundColor: colors.muted, borderColor: colors.warning }]}>
          <Feather name="alert-triangle" size={18} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.text }]}>
            Your role requires two-step verification. Set up at least one method to continue using the app.
          </Text>
        </View>
      )}

      {!online && (
        <View style={card}>
          <Text style={{ color: colors.mutedForeground }}>Two-step verification is managed by the online service. Connect to the server to set it up.</Text>
        </View>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />}

      {recoveryCodes && (
        <View style={[...card, { borderColor: colors.warning }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Save your recovery codes</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Each code signs you in once if you lose your phone. Store them somewhere safe and offline. They won't be shown again.
          </Text>
          <View style={styles.codes}>
            {recoveryCodes.map((c) => (
              <Text key={c} style={[styles.code, { color: colors.text, borderColor: colors.border }]} selectable>
                {c}
              </Text>
            ))}
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={() => Clipboard.setStringAsync(recoveryCodes.join("\n"))}>
              <Text style={[styles.secondaryText, { color: colors.primary }]}>Copy codes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => {
                setRecoveryCodes(null);
                if (finishingRequiredSetup) goHome();
              }}
            >
              <Text style={styles.primaryText}>I've saved them</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {online && status && !recoveryCodes && (
        <>
          {/* Authenticator app */}
          <View style={card}>
            <View style={styles.methodHeader}>
              <Feather name="smartphone" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>Authenticator app</Text>
              <Text style={[styles.badge, { color: status.totpEnabled ? colors.success : colors.mutedForeground }]}>{status.totpEnabled ? "On" : "Off"}</Text>
            </View>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Recommended. Works without mobile signal. Use Google Authenticator, Microsoft Authenticator, Authy or similar.
            </Text>

            {flow.kind === "totp" ? (
              <View style={{ gap: 12 }}>
                <Text style={[styles.step, { color: colors.text }]}>1. Scan this code with your authenticator app (on another device), or open it on this phone:</Text>
                <View style={{ alignItems: "center" }}>
                  <QrCode value={flow.uri} size={200} />
                </View>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary, flex: 1 }]} onPress={() => Linking.openURL(flow.uri).catch(() => Alert.alert("No authenticator app", "Install an authenticator app, or enter the key manually."))}>
                    <Text style={[styles.secondaryText, { color: colors.primary }]}>Open in app</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary, flex: 1 }]} onPress={() => Clipboard.setStringAsync(flow.secret)}>
                    <Text style={[styles.secondaryText, { color: colors.primary }]}>Copy key</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.key, { color: colors.mutedForeground }]} selectable>
                  Manual key: {flow.secret.replace(/(.{4})/g, "$1 ").trim()}
                </Text>
                <Text style={[styles.step, { color: colors.text }]}>2. Enter the 6-digit code it shows:</Text>
                <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" placeholderTextColor={colors.mutedForeground} style={input} accessibilityLabel="Authenticator code" />
                {error !== "" && <Text style={[styles.error, { color: colors.fatal }]}>{error}</Text>}
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={resetFlow}>
                    <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={confirmTotp} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Turn on</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : flow.kind === "disable" && flow.method === "totp" ? (
              <DisableForm colors={colors} code={code} setCode={setCode} proofMethod={proofMethod} setProofMethod={setProofMethod} error={error} busy={busy} onCancel={resetFlow} onConfirm={() => confirmDisable("totp")} />
            ) : (
              <TouchableOpacity
                style={[status.totpEnabled ? styles.secondaryBtn : styles.primaryBtn, status.totpEnabled ? { borderColor: colors.fatal } : { backgroundColor: colors.primary }]}
                onPress={() => (status.totpEnabled ? setFlow({ kind: "disable", method: "totp" }) : beginTotp())}
                disabled={busy || flow.kind !== "none"}
              >
                <Text style={status.totpEnabled ? [styles.secondaryText, { color: colors.fatal }] : styles.primaryText}>{status.totpEnabled ? "Remove" : "Set up authenticator"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SMS */}
          <View style={card}>
            <View style={styles.methodHeader}>
              <Feather name="message-square" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>Text message (SMS)</Text>
              <Text style={[styles.badge, { color: status.smsEnabled ? colors.success : colors.mutedForeground }]}>{status.smsEnabled ? "On" : "Off"}</Text>
            </View>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {status.smsEnabled ? `Codes go to ${status.smsMaskedPhone}.` : "Receive a one-time code by SMS. Needs mobile signal."}
            </Text>
            {flow.kind === "sms-phone" ? (
              <View style={{ gap: 12 }}>
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08012345678 or +2348012345678" placeholderTextColor={colors.mutedForeground} style={[...input, styles.phoneInput]} accessibilityLabel="Phone number" />
                {error !== "" && <Text style={[styles.error, { color: colors.fatal }]}>{error}</Text>}
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={resetFlow}>
                    <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={sendSmsCode} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send code</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : flow.kind === "sms-code" ? (
              <View style={{ gap: 12 }}>
                <Text style={[styles.step, { color: colors.text }]}>
                  Enter the code sent to {flow.maskedPhone}.{flow.devCode ? ` (Development code: ${flow.devCode})` : ""}
                </Text>
                <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" placeholderTextColor={colors.mutedForeground} textContentType="oneTimeCode" style={input} accessibilityLabel="SMS code" />
                {error !== "" && <Text style={[styles.error, { color: colors.fatal }]}>{error}</Text>}
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={resetFlow}>
                    <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={confirmSms} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Turn on</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : flow.kind === "disable" && flow.method === "sms" ? (
              <DisableForm colors={colors} code={code} setCode={setCode} proofMethod={proofMethod} setProofMethod={setProofMethod} error={error} busy={busy} onCancel={resetFlow} onConfirm={() => confirmDisable("sms")} />
            ) : (
              <TouchableOpacity
                style={[status.smsEnabled ? styles.secondaryBtn : styles.primaryBtn, status.smsEnabled ? { borderColor: colors.fatal } : { backgroundColor: colors.primary }]}
                onPress={() => (status.smsEnabled ? setFlow({ kind: "disable", method: "sms" }) : setFlow({ kind: "sms-phone" }))}
                disabled={busy || flow.kind !== "none"}
              >
                <Text style={status.smsEnabled ? [styles.secondaryText, { color: colors.fatal }] : styles.primaryText}>{status.smsEnabled ? "Remove" : "Set up SMS"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {status.enrolled && (
            <View style={card}>
              <View style={styles.methodHeader}>
                <Feather name="key" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>Recovery codes</Text>
                <Text style={[styles.badge, { color: colors.mutedForeground }]}>{status.recoveryCodesRemaining} left</Text>
              </View>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>Single-use codes for when you can't reach your phone.</Text>
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={newRecoveryCodes} disabled={busy}>
                <Text style={[styles.secondaryText, { color: colors.primary }]}>Generate new codes</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function DisableForm(props: {
  colors: ReturnType<typeof useColors>;
  code: string;
  setCode: (v: string) => void;
  proofMethod: "totp" | "recovery";
  setProofMethod: (m: "totp" | "recovery") => void;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = props;
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.step, { color: colors.text }]}>Confirm with a current code to remove this method.</Text>
      <View style={styles.row}>
        {(["totp", "recovery"] as const).map((m) => (
          <TouchableOpacity key={m} onPress={() => props.setProofMethod(m)} style={[styles.secondaryBtn, { flex: 1, borderColor: props.proofMethod === m ? colors.primary : colors.border }]}>
            <Text style={[styles.secondaryText, { color: props.proofMethod === m ? colors.primary : colors.mutedForeground }]}>{m === "totp" ? "Authenticator" : "Recovery code"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        value={props.code}
        onChangeText={props.setCode}
        keyboardType={props.proofMethod === "totp" ? "number-pad" : "default"}
        autoCapitalize="characters"
        placeholder={props.proofMethod === "totp" ? "123456" : "ABCD-EFGH"}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      {props.error !== "" && <Text style={[styles.error, { color: colors.fatal }]}>{props.error}</Text>}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={props.onCancel}>
          <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.fatal, flex: 1 }]} onPress={props.onConfirm} disabled={props.busy}>
          {props.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Remove</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 14 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  banner: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  bannerText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  methodHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  step: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  key: { fontSize: 13, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 20, letterSpacing: 4, textAlign: "center", fontFamily: "Inter_600SemiBold" },
  phoneInput: { fontSize: 16, letterSpacing: 0 },
  error: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 10 },
  primaryBtn: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  secondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  codes: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  code: { width: "46%", textAlign: "center", paddingVertical: 8, borderWidth: 1, borderRadius: 8, fontSize: 15, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
});
