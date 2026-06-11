import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
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
import { useAuth } from "@/context/AuthContext";
import {
  Referral,
  ReferralRecordType,
  ReferralSnapshot,
  useReferrals,
} from "@/context/ReferralContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";

interface ReferModalProps {
  visible: boolean;
  onClose: () => void;
  recordType: ReferralRecordType;
  recordId: string;
  snapshot: ReferralSnapshot;
  onReferred?: (referral: Referral) => void;
}

export function ReferModal({
  visible,
  onClose,
  recordType,
  recordId,
  snapshot,
  onReferred,
}: ReferModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addReferral } = useReferrals();
  const { referableAgencies } = usePermissions();
  const { getAgencyById } = useAgency();

  const [target, setTarget] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setTarget(null);
      setNote("");
      setSubmitting(false);
    }
  }, [visible]);

  async function handleSubmit() {
    if (!user || !target || submitting) return;
    setSubmitting(true);
    try {
      const created = await addReferral({
        fromAgency: user.agency,
        toAgency: target as Referral["toAgency"],
        recordType,
        recordId,
        snapshot,
        createdBy: user.id,
        createdByName: user.name,
        initialNote: note,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const toName = getAgencyById(target)?.fullName ?? "the agency";
      onReferred?.(created);
      onClose();
      Alert.alert("Referral sent", `This record has been referred to ${toName}.`);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Could not send", "Something went wrong creating the referral.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Refer to another agency</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Record snapshot preview */}
            <View style={[styles.preview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
                {snapshot.title}
              </Text>
              <View style={styles.previewMetaRow}>
                {snapshot.plate ? (
                  <View style={[styles.plateChip, { backgroundColor: colors.info + "18" }]}>
                    <Feather name="hash" size={11} color={colors.info} />
                    <Text style={[styles.plateText, { color: colors.info }]}>{snapshot.plate}</Text>
                  </View>
                ) : null}
                {snapshot.location ? (
                  <View style={styles.previewMetaItem}>
                    <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.previewMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {snapshot.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>SEND TO</Text>
            <View style={styles.agencyRow}>
              {referableAgencies.map((id) => {
                const ag = getAgencyById(id);
                const active = target === id;
                const color = ag?.primaryColor ?? colors.primary;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setTarget(id)}
                    style={[
                      styles.agencyCard,
                      {
                        backgroundColor: active ? color + "14" : colors.background,
                        borderColor: active ? color : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.agencyIcon, { backgroundColor: color + "1A" }]}>
                      <Feather name={(ag?.icon as keyof typeof Feather.glyphMap) ?? "shield"} size={18} color={color} />
                    </View>
                    <Text style={[styles.agencyName, { color: colors.text }]} numberOfLines={1}>
                      {ag?.shortName ?? id}
                    </Text>
                    <Text style={[styles.agencyFull, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {ag?.fullName ?? ""}
                    </Text>
                    {active && (
                      <View style={[styles.agencyCheck, { backgroundColor: color }]}>
                        <Feather name="check" size={11} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add context for the receiving agency…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!target || submitting}
              style={[
                styles.submit,
                { backgroundColor: !target || submitting ? colors.muted : colors.primary },
              ]}
            >
              <Feather name="send" size={16} color={!target || submitting ? colors.mutedForeground : "#fff"} />
              <Text style={[styles.submitText, { color: !target || submitting ? colors.mutedForeground : "#fff" }]}>
                {submitting ? "Sending…" : "Send referral"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#9AA5B1", marginBottom: 12, opacity: 0.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  preview: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 18 },
  previewTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  previewMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  previewMetaItem: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  previewMeta: { fontSize: 12, fontFamily: "Inter_400Regular", flexShrink: 1 },
  plateChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  plateText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginBottom: 10 },
  agencyRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  agencyCard: { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  agencyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  agencyName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  agencyFull: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  agencyCheck: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 18,
  },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: Platform.OS === "web" ? 20 : 4,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
