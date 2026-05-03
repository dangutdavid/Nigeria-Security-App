import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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

export default function ResetPinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { badge } = useLocalSearchParams<{ badge: string }>();
  const { resetPinWithOtp } = useAuth();

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const strength =
    newPin.length >= 8 ? "strong" : newPin.length >= 6 ? "moderate" : "weak";

  async function handleReset() {
    if (!newPin) {
      Alert.alert("Required", "Please enter a new PIN.");
      return;
    }
    if (newPin.length < 4) {
      Alert.alert("Too Short", "PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("Mismatch", "PINs do not match.");
      return;
    }
    setSaving(true);
    const ok = await resetPinWithOtp(badge, newPin);
    setSaving(false);

    if (ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "PIN Reset Successful",
        "Your PIN has been updated. You can now sign in with your new PIN.",
        [{ text: "Sign In", onPress: () => router.replace("/") }]
      );
    } else {
      Alert.alert(
        "Session Expired",
        "Your OTP session has expired. Please start over.",
        [{ text: "OK", onPress: () => router.replace("/forgot-pin") }]
      );
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
          <View style={{ width: 22 }} />
          <Text style={styles.headerTitle}>Set New PIN</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: colors.successLight }]}>
            <Feather name="check-circle" size={36} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Identity Verified
          </Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            Create a new PIN for badge{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              {badge}
            </Text>
            . Use at least 6 digits for a secure PIN.
          </Text>

          {/* New PIN */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              New PIN
            </Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter new PIN"
                placeholderTextColor={colors.mutedForeground}
                value={newPin}
                onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, ""))}
                secureTextEntry={!showNew}
                keyboardType="number-pad"
                maxLength={8}
              />
              <TouchableOpacity onPress={() => setShowNew((s) => !s)}>
                <Feather
                  name={showNew ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            {/* Strength bar */}
            {newPin.length > 0 && (
              <View
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      strength === "strong"
                        ? colors.successLight
                        : strength === "moderate"
                        ? colors.warningLight
                        : colors.fatalLight,
                  },
                ]}
              >
                <Feather
                  name={strength === "weak" ? "alert-circle" : "shield"}
                  size={13}
                  color={
                    strength === "strong"
                      ? colors.success
                      : strength === "moderate"
                      ? colors.warning
                      : colors.fatal
                  }
                />
                <Text
                  style={[
                    styles.strengthText,
                    {
                      color:
                        strength === "strong"
                          ? colors.success
                          : strength === "moderate"
                          ? colors.warning
                          : colors.fatal,
                    },
                  ]}
                >
                  {strength === "strong"
                    ? "Strong PIN"
                    : strength === "moderate"
                    ? "Moderate PIN"
                    : "Weak — use at least 6 digits"}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm PIN */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Confirm New PIN
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  borderColor:
                    confirmPin && confirmPin !== newPin
                      ? colors.fatal
                      : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Re-enter new PIN"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, ""))}
                secureTextEntry={!showConfirm}
                keyboardType="number-pad"
                maxLength={8}
              />
              <TouchableOpacity onPress={() => setShowConfirm((s) => !s)}>
                <Feather
                  name={showConfirm ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
            {confirmPin && confirmPin !== newPin && (
              <Text style={[styles.matchError, { color: colors.fatal }]}>
                PINs do not match
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: saving ? 0.7 : 1,
              },
            ]}
            onPress={handleReset}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>
              {saving ? "Saving…" : "Set New PIN"}
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
    gap: 18,
    justifyContent: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
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
    lineHeight: 21,
  },
  fieldWrap: { gap: 8 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
    padding: 0,
  },
  strengthBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  strengthText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  matchError: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginLeft: 4,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
