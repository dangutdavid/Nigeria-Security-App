import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { AgencyUpdateInput, useAgency } from "@/context/AgencyContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { canCustomizeOwnAgency, canManageAgencies } from "@/lib/permissions";

const COLOR_OPTIONS = ["#1B5E3B", "#1A3A6C", "#7B3F00", "#234E2A", "#344054", "#5C6BC0", "#8B1E3F", "#0F766E", "#B42318", "#111827", "#C8960C", "#0F4C81"];
const ICON_OPTIONS: Array<keyof typeof Feather.glyphMap> = ["shield", "star", "clipboard", "settings", "alert-octagon", "truck", "activity", "flag", "award", "anchor", "home", "briefcase"];

export default function AgencyCustomizeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ agencyId?: string }>();
  const { user } = useAuth();
  const { getAgencyById, updateAgency } = useAgency();

  const targetId = (typeof params.agencyId === "string" && params.agencyId) || user?.agency || "";
  const agency = getAgencyById(targetId);

  // Admins may edit any agency's full details; agency super-users (commander /
  // super_admin) may only re-brand their OWN agency (colours + logo).
  const isAdmin = canManageAgencies(user?.role);
  const ownAgency = Boolean(user && targetId === user.agency);
  const allowed = isAdmin || (canCustomizeOwnAgency(user?.role) && ownAgency);
  const fullEdit = isAdmin;

  const [name, setName] = useState(agency?.name ?? "");
  const [shortName, setShortName] = useState(agency?.shortName ?? "");
  const [fullName, setFullName] = useState(agency?.fullName ?? "");
  const [badgePrefix, setBadgePrefix] = useState(agency?.badgePrefix ?? "");
  const [description, setDescription] = useState(agency?.description ?? "");
  const [primaryColor, setPrimaryColor] = useState(agency?.primaryColor ?? "#344054");
  const [secondaryColor, setSecondaryColor] = useState(agency?.secondaryColor ?? "#667085");
  const [icon, setIcon] = useState<string>(agency?.icon ?? "shield");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const previewLabel = useMemo(() => (shortName || agency?.shortName || "AGENCY").toUpperCase(), [shortName, agency]);

  if (!user) return <Redirect href="/" />;
  if (!agency || !allowed) return <Redirect href="/unauthorized" />;

  async function save() {
    if (!agency) return;
    const updates: AgencyUpdateInput = fullEdit
      ? { name, shortName, fullName, badgePrefix, description, primaryColor, secondaryColor, icon }
      : { primaryColor, secondaryColor, icon };
    setSaving(true);
    setError("");
    try {
      await updateAgency(agency.id, updates, user?.name ?? "Admin");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: primaryColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Customise {agency.shortName}</Text>
          <Text style={styles.headerSub}>{fullEdit ? "Edit agency details, theme and logo" : "Update your agency theme and logo"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AgencyEmblem agency={agency.id} size={64} color={primaryColor} label={previewLabel} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewName, { color: colors.text }]}>{shortName || agency.shortName}</Text>
            <Text style={[styles.previewFull, { color: colors.mutedForeground }]} numberOfLines={2}>{fullName || agency.fullName}</Text>
            <View style={styles.previewSwatchRow}>
              <View style={[styles.previewSwatch, { backgroundColor: primaryColor }]} />
              <View style={[styles.previewSwatch, { backgroundColor: secondaryColor }]} />
              <Feather name={(icon as keyof typeof Feather.glyphMap) in Feather.glyphMap ? (icon as keyof typeof Feather.glyphMap) : "shield"} size={18} color={primaryColor} />
            </View>
          </View>
        </View>

        {fullEdit ? (
          <>
            <Field label="Short name" value={shortName} onChangeText={setShortName} placeholder="e.g. FFS" colors={colors} />
            <Field label="Display name" value={name} onChangeText={setName} placeholder="e.g. Fire Service" colors={colors} />
            <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Federal Fire Service" colors={colors} />
            <Field label="Badge prefix" value={badgePrefix} onChangeText={setBadgePrefix} placeholder="e.g. FFS" colors={colors} />
            <Field label="Mandate / description" value={description} onChangeText={setDescription} placeholder="Mandate..." colors={colors} multiline />
          </>
        ) : (
          <View style={[styles.noticeCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="info" size={15} color={colors.mutedForeground} />
            <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
              You can update your agency theme and logo. Contact a platform administrator to change the agency name or registration details.
            </Text>
          </View>
        )}

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Primary (theme) colour</Text>
        <View style={styles.swatches}>
          {COLOR_OPTIONS.map((color) => (
            <TouchableOpacity key={color} style={[styles.swatch, { backgroundColor: color, borderColor: primaryColor === color ? colors.text : "transparent" }]} onPress={() => setPrimaryColor(color)}>
              {primaryColor === color ? <Feather name="check" size={16} color="#fff" /> : null}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Secondary colour</Text>
        <View style={styles.swatches}>
          {COLOR_OPTIONS.map((color) => (
            <TouchableOpacity key={color} style={[styles.swatch, { backgroundColor: color, borderColor: secondaryColor === color ? colors.text : "transparent" }]} onPress={() => setSecondaryColor(color)}>
              {secondaryColor === color ? <Feather name="check" size={16} color="#fff" /> : null}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Logo icon</Text>
        <View style={styles.iconGrid}>
          {ICON_OPTIONS.map((option) => {
            const active = icon === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.iconChip, { backgroundColor: active ? primaryColor : colors.card, borderColor: active ? primaryColor : colors.border }]}
                onPress={() => setIcon(option)}
              >
                <Feather name={option} size={20} color={active ? "#fff" : colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primaryColor }]} onPress={save} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        style={[styles.input, multiline && styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 16 },
  headerCopy: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  previewCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 16 },
  previewName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  previewFull: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2, lineHeight: 17 },
  previewSwatchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  previewSwatch: { width: 22, height: 22, borderRadius: 7 },
  noticeCard: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  fieldWrap: { marginBottom: 14, gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_500Medium" },
  textArea: { minHeight: 86, textAlignVertical: "top" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  iconChip: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#C0392B", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  saveBtn: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 16 },
  saveText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
