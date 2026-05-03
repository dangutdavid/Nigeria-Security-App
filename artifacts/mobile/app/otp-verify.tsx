import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function OtpVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { badge, email } = useLocalSearchParams<{ badge: string; email: string }>();
  const { verifyOtp, requestOtp } = useAuth();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  function handleDigit(value: string, index: number) {
    const cleaned = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError("");
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = digits.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits of the code.");
      return;
    }
    setError("");
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await verifyOtp(badge, code);
    setLoading(false);

    if (result === "ok") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/reset-pin",
        params: { badge },
      });
    } else if (result === "expired") {
      setError("This code has expired. Please request a new one.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setError("Incorrect code. Please check and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Clear digits on wrong code
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    const { result, code } = await requestOtp(badge, email);
    if (result === "sent") {
      setResendCooldown(60);
      setDigits(["", "", "", "", "", ""]);
      setError("");
      Alert.alert(
        "New Code Sent",
        `A new 6-digit code has been sent.\n\n(Demo mode — your code is: ${code})`
      );
    } else {
      Alert.alert("Error", "Could not resend code. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.primary, paddingTop: topPad + 12 },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Enter OTP</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.body}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            <Feather name="message-square" size={36} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Verify Your Identity
          </Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              {email}
            </Text>
          </Text>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                style={[
                  styles.otpBox,
                  {
                    borderColor: d ? colors.primary : colors.border,
                    backgroundColor: colors.card,
                    color: colors.text,
                  },
                ]}
                value={d}
                onChangeText={(v) => handleDigit(v, i)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, i)
                }
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={i === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.fatalLight,
                  borderColor: colors.fatal,
                },
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
              styles.verifyBtn,
              {
                backgroundColor: colors.primary,
                opacity: loading || digits.join("").length < 6 ? 0.6 : 1,
              },
            ]}
            onPress={handleVerify}
            disabled={loading || digits.join("").length < 6}
            activeOpacity={0.85}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.verifyBtnText}>
              {loading ? "Verifying…" : "Verify Code"}
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
            style={styles.resendLink}
          >
            <Text
              style={[
                styles.resendText,
                {
                  color:
                    resendCooldown > 0
                      ? colors.mutedForeground
                      : colors.primary,
                },
              ]}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive a code? Resend"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  body: {
    flex: 1,
    padding: 24,
    gap: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginVertical: 8,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignSelf: "stretch",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  verifyBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
  },
  verifyBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  resendLink: {
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
