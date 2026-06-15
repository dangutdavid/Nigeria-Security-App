import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToolBackHeader } from "@/components/ToolBackHeader";
import { REFERRAL_STATUS_LABELS, useReferrals } from "@/context/ReferralContext";
import { useColors } from "@/hooks/useColors";

export default function AdminReferralsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { referrals } = useReferrals();
  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}>
      <ToolBackHeader title="Admin Tools" />
      <Text style={[styles.title, { color: colors.text }]}>Referrals</Text>
      {referrals.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{r.snapshot.title}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>{r.fromAgency.toUpperCase()} → {r.toAgency.toUpperCase()} · {REFERRAL_STATUS_LABELS[r.status]}</Text>
          <Text style={[styles.summary, { color: colors.text }]}>{r.snapshot.summary ?? "No summary"}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>{new Date(r.createdAt).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  meta: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  summary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 8 },
});
