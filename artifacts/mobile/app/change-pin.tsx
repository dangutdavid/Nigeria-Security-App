import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

export default function ChangePinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, login, resetPin } = useAuth();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const confirmRef = React.useRef<import("react-native").TextInput>(null);
  const newPinRef = React.useRef<import("react-native").TextInput>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  async function handleChange() {
    if (!currentPin || !newPin || !confirmPin) {
      Alert.alert("Required", "Please fill in all fields.");
      return;
    }
    if (newPin.length < 4) {
      Alert.alert("Too Short", "New PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("Mismatch", "New PIN and confirmation do not match.");
      return;
    }
    if (newPin === currentPin) {
      Alert.alert("Same PIN", "Your new PIN must be different from the current PIN.");
      return;
    }

    setSaving(true);
    // Verify current PIN by attempting login
    const result = await login(user?.badgeNumber ?? "", currentPin);
    if (result !== "ok") {
      setSaving(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Incorrect PIN", "Your current PIN is incorrect.");
      return;
    }

    await resetPin(user?.id ?? "", newPin);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Your PIN has been changed successfully.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change PIN</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.body}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            <Feather name="lock" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Enter your current PIN to verify your identity, then set a new PIN of at least 4 digits.
          </Text>

          {/* Fields */}
          <View style={[styles.fieldsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <PinField
              label="Current PIN"
              value={currentPin}
              onChange={setCurrentPin}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <PinField
              label="New PIN"
              value={newPin}
              inputRef={newPinRef}
              onChange={(v) => {
                setNewPin(v);
                if (v.length >= 4) confirmRef.current?.focus();
              }}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              colors={colors}
            />
            {newPin.length > 0 && (() => {
              const isRepeating = /^(.)\1+$/.test(newPin);
              const isSequential = newPin === "1234" || newPin === "4321" || newPin === "0000" || newPin === "1111";
              const strength = newPin.length < 4 ? "weak" : newPin.length === 4 && (isRepeating || isSequential) ? "fair" : newPin.length >= 6 ? "strong" : "ok";
              const colors_map: Record<string, string> = { weak: "#C0392B", fair: "#E67E22", ok: "#C8960C", strong: "#27AE60" };
              const label_map: Record<string, string> = { weak: "Weak", fair: "Fair", ok: "Good", strong: "Strong" };
              const width_map: Record<string, string> = { weak: "25%", fair: "50%", ok: "75%", strong: "100%" };
              return (
                <View style={[styles.divider, { backgroundColor: "transparent" }]}>
                  <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>PIN strength</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors_map[strength] }}>{label_map[strength]}</Text>
                    </View>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.muted }}>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors_map[strength], width: width_map[strength] as any }} />
                    </View>
                  </View>
                </View>
              );
            })()}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <PinField
              label="Confirm New PIN"
              value={confirmPin}
              inputRef={confirmRef}
              onChange={(v) => {
                setConfirmPin(v);
                if (v.length >= 4 && v.length === newPin.length && v === newPin && currentPin.length >= 4) {
                  handleChange();
                }
              }}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              colors={colors}
            />
          </View>

          {/* PIN strength hint */}
          {newPin.length > 0 && (
            <View
              style={[
                styles.strengthBar,
                {
                  backgroundColor:
                    newPin.length >= 8
                      ? colors.successLight
                      : newPin.length >= 6
                      ? colors.warningLight
                      : colors.fatalLight,
                },
              ]}
            >
              <Feather
                name={newPin.length >= 6 ? "shield" : "alert-circle"}
                size={13}
                color={newPin.length >= 8 ? colors.success : newPin.length >= 6 ? colors.warning : colors.fatal}
              />
              <Text
                style={[
                  styles.strengthText,
                  {
                    color:
                      newPin.length >= 8
                        ? colors.success
                        : newPin.length >= 6
                        ? colors.warning
                        : colors.fatal,
                  },
                ]}
              >
                {newPin.length >= 8 ? "Strong PIN" : newPin.length >= 6 ? "Moderate PIN" : "Weak PIN — use at least 6 digits"}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.changeBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={handleChange}
            disabled={saving}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.changeBtnText}>
              {saving ? "Verifying…" : "Change PIN"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function PinField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  colors,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  inputRef?: React.RefObject<import("react-native").TextInput | null>;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.fieldInput}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          secureTextEntry={!show}
          placeholder="••••"
          placeholderTextColor={colors.border}
          maxLength={8}
        />
        <TouchableOpacity onPress={onToggleShow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name={show ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
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
    padding: 20,
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  fieldsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  fieldRow: {
    padding: 16,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
    padding: 0,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
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
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  changeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
