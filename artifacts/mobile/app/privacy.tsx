import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

/**
 * Privacy notice (transparency: GDPR Arts. 13-14, NDPA s.27, PIPEDA
 * Principle 8). Text in [brackets] must be completed by the data controller —
 * see docs/compliance/README.md. Keep in sync with the legal privacy policy.
 */
const CONTROLLER = process.env.EXPO_PUBLIC_DATA_CONTROLLER ?? "[Data controller — name of the operating agency/ministry]";
const DPO_CONTACT = process.env.EXPO_PUBLIC_DPO_CONTACT ?? "[Data protection officer — e-mail and phone]";

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Who is responsible",
    body: [`${CONTROLLER} is responsible for your information. Contact our data protection officer: ${DPO_CONTACT}.`],
  },
  {
    title: "What we collect when you report",
    body: [
      "What you tell us: the incident type, description, location, and optional photos or vehicle plate.",
      "Your location, if you allow it, so the right agency can respond.",
      "A random code created on your phone, so you can track your report and manage your data. We don't need your name or phone number to accept a report.",
    ],
  },
  {
    title: "Why we use it",
    body: [
      "To route your report to the responsible agency (FRSC, Police, VIO or NSCDC) and to respond to it. This is a public-safety task carried out under law.",
      "To keep services secure and to produce anonymous statistics, such as crash hotspots.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "Only officers of the agency handling your report, and platform administrators. The system enforces this in the database itself.",
      "Service providers who host and secure the system under contract (hosting, error monitoring, logging, SMS). They may not use your information for anything else.",
    ],
  },
  {
    title: "How long we keep it",
    body: ["Closed reports are kept for up to [7] years, then personal details are removed and only anonymous statistics remain. Some records must be kept longer by law."],
  },
  {
    title: "Your rights",
    body: [
      "Get a copy of your report: open Track Report on the phone you used and tap “Download my data”.",
      "Ask for deletion: tap “Request deletion”. We answer within one month. We may keep some information where the law requires it, for example during an investigation.",
      "Correct information, object, or complain: contact the data protection officer. You can also complain to the Nigeria Data Protection Commission (NDPC).",
    ],
  },
  {
    title: "Where it is stored",
    body: ["[Hosting location and the safeguards for any transfer outside Nigeria — complete before launch.]"],
  },
];

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button">
        <Feather name="arrow-left" size={20} color={colors.text} />
        <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>How we use your information</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{section.title}</Text>
          {section.body.map((line) => (
            <Text key={line} style={[styles.body, { color: colors.mutedForeground }]}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
});
