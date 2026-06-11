import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AGENCIES } from "@/context/AgencyContext";
import { REFERRAL_STATUS_LABELS } from "@/context/ReferralContext";
import { formatMinutesAgo } from "@/context/TheftReportContext";
import { useColors } from "@/hooks/useColors";
import { usePlateFlags } from "@/hooks/usePlateFlags";

const agencyName = (id: string) => AGENCIES.find((a) => a.id === id)?.shortName ?? id.toUpperCase();

/**
 * Consistent, agency-neutral plate intelligence banner. Surfaces active
 * stolen-vehicle reports and open cross-agency referrals for a plate.
 * Renders nothing when the plate is clean or empty.
 */
export function PlateFlagBanner({
  plate,
  kinds = ["theft", "referral"],
}: {
  plate: string;
  kinds?: ("theft" | "referral")[];
}) {
  const colors = useColors();
  const { theftMatches, referrals } = usePlateFlags(plate);

  const showTheft = kinds.includes("theft") && theftMatches.length > 0;
  const showReferral = kinds.includes("referral") && referrals.length > 0;
  if (!showTheft && !showReferral) return null;

  return (
    <View style={styles.wrap}>
      {showTheft &&
        theftMatches.map((t) => (
          <View key={t.id} style={[styles.card, { backgroundColor: "#FDECEA", borderColor: "#E5393566" }]}>
            <View style={styles.row}>
              <Feather name="alert-octagon" size={18} color="#C0392B" />
              <Text style={styles.title}>STOLEN VEHICLE ALERT</Text>
            </View>
            <Text style={styles.body}>
              Plate {t.plate} — {t.color} {t.make} {t.model} reported stolen ({formatMinutesAgo(t.reportedAt)}).
            </Text>
            <Text style={styles.meta}>
              {t.location}
              {t.reporterName ? ` · Reported by ${t.reporterName}` : ""}
            </Text>
          </View>
        ))}

      {showReferral &&
        referrals.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: "#FFF4E5", borderColor: "#E67E2266" }]}>
            <View style={styles.row}>
              <Feather name="git-pull-request" size={18} color="#B9651B" />
              <Text style={[styles.title, { color: "#B9651B" }]}>CROSS-AGENCY FLAG</Text>
            </View>
            <Text style={styles.body}>{r.snapshot.title}</Text>
            {r.snapshot.summary ? (
              <Text style={[styles.meta, { color: colors.text }]} numberOfLines={3}>
                {r.snapshot.summary}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {agencyName(r.fromAgency)} → {agencyName(r.toAgency)} · {REFERRAL_STATUS_LABELS[r.status]} · {r.createdByName}
            </Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#C0392B", letterSpacing: 0.5 },
  body: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1A1A1A" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B5B4D" },
});
