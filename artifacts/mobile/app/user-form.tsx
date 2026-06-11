import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { useAgency } from "@/context/AgencyContext";
import { useAuth, UserRole, UserStatus } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { assignableRoles } from "@/lib/permissions";

const ROLE_OPTIONS: { label: string; value: UserRole; color: string }[] = [
  { label: "Field Officer", value: "field_officer", color: "#2C7BE5" },
  { label: "Supervisor", value: "supervisor", color: "#C8960C" },
  { label: "Commander", value: "commander", color: "#1B5E3B" },
];

const STATUS_OPTIONS: { label: string; value: UserStatus; color: string }[] = [
  { label: "Active", value: "active", color: "#27AE60" },
  { label: "Inactive", value: "inactive", color: "#6B7A8A" },
  { label: "Suspended", value: "suspended", color: "#C0392B" },
];

interface FormState {
  name: string;
  badgeNumber: string;
  email: string;
  role: UserRole;
  sector: string;
  station: string;
  phone: string;
  status: UserStatus;
  pin: string;
  confirmPin: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  badgeNumber: "",
  email: "",
  role: "field_officer",
  sector: "",
  station: "",
  phone: "",
  status: "active",
  pin: "",
  confirmPin: "",
};

export default function UserFormScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user: currentUser, getUserById, addUser, updateUser, deleteUser, resetPin, allUsers } = useAuth();

  const isEditing = !!id;
  const editTarget = id ? getUserById(id) : undefined;

  const isCommander = currentUser?.role === "commander";
  const { getAgencyById } = useAgency();
  const agencyColor =
    (currentUser ? getAgencyById(currentUser.agency)?.primaryColor : undefined) ?? colors.primary;

  // Roles this user is allowed to assign (centralized RBAC rule:
  // commanders → any role, supervisors → field officers only).
  const allowedRoles: UserRole[] = assignableRoles(currentUser);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [showResetPin, setShowResetPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  useEffect(() => {
    if (isEditing && editTarget) {
      setForm({
        name: editTarget.name,
        badgeNumber: editTarget.badgeNumber,
        email: editTarget.email ?? "",
        role: editTarget.role,
        sector: editTarget.sector,
        station: editTarget.station,
        phone: editTarget.phone,
        status: editTarget.status,
        pin: "",
        confirmPin: "",
      });
    }
  }, [id]);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Name is required.";
    if (!form.badgeNumber.trim()) return "Badge number is required.";
    if (!form.sector.trim()) return "Sector is required.";
    if (!form.station.trim()) return "Station is required.";
    if (!form.phone.trim()) return "Phone number is required.";
    if (!isEditing) {
      if (!form.pin) return "PIN is required.";
      if (form.pin.length < 4) return "PIN must be at least 4 digits.";
      if (form.pin !== form.confirmPin) return "PINs do not match.";
      // Check duplicate badge
      if (allUsers.some((u) => u.badgeNumber.toUpperCase() === form.badgeNumber.trim().toUpperCase())) {
        return `Badge number ${form.badgeNumber.trim().toUpperCase()} is already in use.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      Alert.alert("Validation Error", err);
      return;
    }
    setSaving(true);
    try {
      if (isEditing && editTarget) {
        await updateUser(editTarget.id, {
          name: form.name.trim(),
          badgeNumber: form.badgeNumber.trim().toUpperCase(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          sector: form.sector.trim(),
          station: form.station.trim(),
          phone: form.phone.trim(),
          status: form.status,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        await addUser(
          {
            name: form.name.trim(),
            badgeNumber: form.badgeNumber.trim().toUpperCase(),
            email: form.email.trim().toLowerCase(),
            role: form.role,
            sector: form.sector.trim(),
            station: form.station.trim(),
            phone: form.phone.trim(),
            status: form.status,
            agency: currentUser?.agency ?? "frsc",
          },
          form.pin
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch {
      Alert.alert("Error", "Could not save user. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editTarget) return;
    if (editTarget.id === currentUser?.id) {
      Alert.alert("Not Allowed", "You cannot delete your own account.");
      return;
    }
    Alert.alert(
      "Delete User",
      `Remove ${editTarget.name} (${editTarget.badgeNumber}) from the system? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteUser(editTarget.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  }

  async function handleResetPin() {
    if (!editTarget) return;
    if (!newPin || newPin.length < 4) {
      Alert.alert("Error", "New PIN must be at least 4 digits.");
      return;
    }
    await resetPin(editTarget.id, newPin);
    setNewPin("");
    setShowResetPin(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "PIN has been reset.");
  }

  const canDelete =
    isEditing && isCommander && editTarget?.id !== currentUser?.id;
  const canEditRole = isCommander;

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
            { backgroundColor: agencyColor, paddingTop: topPad + 12 },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit User" : "Add User"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { opacity: saving ? 0.5 : 1 }]}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section: Personal Info */}
          <SectionLabel label="PERSONAL INFORMATION" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FormField
              label="Full Name"
              icon="user"
              value={form.name}
              onChangeText={(v) => set("name", v)}
              placeholder="e.g. Okafor Emmanuel"
              colors={colors}
            />
            <FormField
              label="Badge Number"
              icon="shield"
              value={form.badgeNumber}
              onChangeText={(v) => set("badgeNumber", v)}
              placeholder="e.g. FO-012"
              autoCapitalize="characters"
              editable={!isEditing}
              colors={colors}
            />
            <FormField
              label="Email Address"
              icon="mail"
              value={form.email}
              onChangeText={(v) => set("email", v)}
              placeholder="officer@frsc.gov.ng"
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />
            <FormField
              label="Phone"
              icon="phone"
              value={form.phone}
              onChangeText={(v) => set("phone", v)}
              placeholder="+234 800 000 0000"
              keyboardType="phone-pad"
              colors={colors}
              last
            />
          </View>

          {/* Section: Assignment */}
          <SectionLabel label="ASSIGNMENT" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FormField
              label="Sector"
              icon="map"
              value={form.sector}
              onChangeText={(v) => set("sector", v)}
              placeholder="e.g. North Central Zone"
              colors={colors}
            />
            <FormField
              label="Station"
              icon="home"
              value={form.station}
              onChangeText={(v) => set("station", v)}
              placeholder="e.g. Kubwa Outpost"
              colors={colors}
              last
            />
          </View>

          {/* Section: Role */}
          <SectionLabel label="ROLE" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {ROLE_OPTIONS.filter((r) => allowedRoles.includes(r.value)).map(
              (opt, i, arr) => {
                const selected = form.role === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => canEditRole || !isEditing ? set("role", opt.value) : undefined}
                    style={[
                      styles.optionRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                        opacity: !canEditRole && isEditing ? 0.5 : 1,
                      },
                    ]}
                    disabled={!canEditRole && isEditing}
                  >
                    <View
                      style={[
                        styles.roleIcon,
                        { backgroundColor: opt.color + "18" },
                      ]}
                    >
                      <Feather name="briefcase" size={16} color={opt.color} />
                    </View>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    {selected && (
                      <Feather name="check" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }
            )}
          </View>

          {/* Section: Status */}
          <SectionLabel label="STATUS" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {STATUS_OPTIONS.map((opt, i, arr) => {
              const selected = form.status === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => set("status", opt.value)}
                  style={[
                    styles.optionRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: opt.color + "20" },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDotInner,
                        { backgroundColor: opt.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>
                    {opt.label}
                  </Text>
                  {selected && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section: PIN — only for new users */}
          {!isEditing && (
            <>
              <SectionLabel label="SECURITY PIN" colors={colors} />
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <FormField
                  label="PIN"
                  icon="lock"
                  value={form.pin}
                  onChangeText={(v) => set("pin", v)}
                  placeholder="4-digit PIN"
                  keyboardType="numeric"
                  secureTextEntry={!showPin}
                  rightIcon={showPin ? "eye-off" : "eye"}
                  onRightIcon={() => setShowPin((p) => !p)}
                  colors={colors}
                />
                <FormField
                  label="Confirm PIN"
                  icon="lock"
                  value={form.confirmPin}
                  onChangeText={(v) => set("confirmPin", v)}
                  placeholder="Re-enter PIN"
                  keyboardType="numeric"
                  secureTextEntry={!showConfirmPin}
                  rightIcon={showConfirmPin ? "eye-off" : "eye"}
                  onRightIcon={() => setShowConfirmPin((p) => !p)}
                  colors={colors}
                  last
                />
              </View>
            </>
          )}

          {/* Section: Reset PIN — for existing users */}
          {isEditing && (
            <>
              <SectionLabel label="SECURITY" colors={colors} />
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {!showResetPin ? (
                  <TouchableOpacity
                    onPress={() => setShowResetPin(true)}
                    style={styles.optionRow}
                  >
                    <View
                      style={[
                        styles.roleIcon,
                        { backgroundColor: colors.infoLight },
                      ]}
                    >
                      <Feather name="key" size={16} color={colors.info} />
                    </View>
                    <Text style={[styles.optionLabel, { color: colors.info }]}>
                      Reset PIN
                    </Text>
                    <Feather name="chevron-right" size={18} color={colors.border} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ padding: 14, gap: 12 }}>
                    <Text style={[styles.resetLabel, { color: colors.text }]}>
                      New PIN for {editTarget?.name}
                    </Text>
                    <View
                      style={[
                        styles.pinInput,
                        { borderColor: colors.border, backgroundColor: colors.background },
                      ]}
                    >
                      <Feather name="lock" size={16} color={colors.mutedForeground} />
                      <TextInput
                        style={[styles.pinInputText, { color: colors.text }]}
                        value={newPin}
                        onChangeText={setNewPin}
                        placeholder="Enter new PIN"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="numeric"
                        secureTextEntry
                        maxLength={8}
                      />
                    </View>
                    <View style={styles.resetActions}>
                      <TouchableOpacity
                        onPress={() => { setShowResetPin(false); setNewPin(""); }}
                        style={[styles.resetCancelBtn, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.resetCancelText, { color: colors.mutedForeground }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleResetPin}
                        style={[styles.resetConfirmBtn, { backgroundColor: colors.primary }]}
                      >
                        <Text style={styles.resetConfirmText}>Reset PIN</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Delete */}
          {canDelete && (
            <View style={{ paddingHorizontal: 14, marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleDelete}
                style={[
                  styles.deleteBtn,
                  { borderColor: colors.destructive + "40", backgroundColor: colors.fatalLight },
                ]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
                  Delete User
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <Text
      style={[
        sectionStyles.label,
        { color: colors.mutedForeground },
      ]}
    >
      {label}
    </Text>
  );
}

function FormField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  editable = true,
  rightIcon,
  onRightIcon,
  last = false,
  colors,
}: {
  label: string;
  icon: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  editable?: boolean;
  rightIcon?: string;
  onRightIcon?: () => void;
  last?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        fieldStyles.row,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : 1,
          opacity: editable ? 1 : 0.55,
        },
      ]}
    >
      <View style={[fieldStyles.icon, { backgroundColor: colors.muted }]}>
        <Feather name={icon as any} size={15} color={colors.mutedForeground} />
      </View>
      <View style={fieldStyles.content}>
        <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <TextInput
          style={[fieldStyles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.border}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "words"}
          secureTextEntry={secureTextEntry}
          editable={editable}
        />
      </View>
      {rightIcon && onRightIcon && (
        <TouchableOpacity onPress={onRightIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name={rightIcon as any} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 16,
  },
});

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  saveBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    marginHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  roleIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  statusDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resetLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  pinInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pinInputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  resetActions: {
    flexDirection: "row",
    gap: 10,
  },
  resetCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  resetCancelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  resetConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  resetConfirmText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
