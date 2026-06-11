import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type ContactType = "hotline" | "ambulance" | "road" | "disaster";

interface EmergencyContact {
  id: string;
  name: string;
  agency: string;
  number: string;
  description: string;
  type: ContactType;
  priority: "critical" | "high" | "support";
  availability: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: "national-112",
    name: "National Emergency Number",
    agency: "Nigeria Emergency Response",
    number: "112",
    description:
      "Primary toll-free emergency line for police, fire, medical, and rescue coordination.",
    type: "hotline",
    priority: "critical",
    availability: "24/7 nationwide",
  },
  {
    id: "police-rapid",
    name: "Police Control Room",
    agency: "Nigeria Police Force",
    number: "199",
    description:
      "Escalate active threats, robbery, violence, or suspicious movement to the police desk.",
    type: "hotline",
    priority: "critical",
    availability: "24/7 command desk",
  },
  {
    id: "frsc-road",
    name: "Road Crash Response",
    agency: "Federal Road Safety Corps",
    number: "122",
    description:
      "Report road crashes, obstructions, trapped victims, or traffic rescue needs.",
    type: "road",
    priority: "high",
    availability: "24/7 road safety",
  },
  {
    id: "ambulance",
    name: "Medical Ambulance",
    agency: "Emergency Medical Service",
    number: "767",
    description:
      "Request urgent medical evacuation for severe injury, bleeding, unconsciousness, or shock.",
    type: "ambulance",
    priority: "high",
    availability: "State response line",
  },
  {
    id: "nema",
    name: "Disaster Response",
    agency: "NEMA / SEMA Coordination",
    number: "0800-2255-6362",
    description:
      "Use for flood, fire, building collapse, mass casualty, and disaster coordination.",
    type: "disaster",
    priority: "support",
    availability: "National support desk",
  },
];

const SAFETY_CHECKLIST = [
  "Move yourself and victims away from traffic, fire, floodwater, or active danger if safe to do so.",
  "Call 112 first for life-threatening emergencies, then contact the specialist agency if needed.",
  "Share the nearest landmark, state, LGA, road name, and direction of travel.",
  "Do not disturb evidence unless it is necessary to save life or prevent further harm.",
];

const TYPE_META: Record<
  ContactType,
  { icon: keyof typeof Feather.glyphMap; color: string }
> = {
  hotline: { icon: "phone-call", color: "#C0392B" },
  ambulance: { icon: "heart", color: "#D35400" },
  road: { icon: "truck", color: "#0B7A3B" },
  disaster: { icon: "alert-octagon", color: "#5B4B8A" },
};

export default function EmergencyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const criticalContacts = useMemo(
    () =>
      EMERGENCY_CONTACTS.filter((contact) => contact.priority === "critical"),
    [],
  );

  async function callNumber(number: string) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const url = `tel:${number.replace(/[^+\d]/g, "")}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return;
    }
    Alert.alert("Calling is unavailable", `Dial ${number} from your phone.`);
  }

  async function copyNumber(contact: EmergencyContact) {
    await Clipboard.setStringAsync(contact.number);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopiedId(contact.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  async function shareContacts() {
    const body = EMERGENCY_CONTACTS.map(
      (contact) => `${contact.name} (${contact.agency}): ${contact.number}`,
    ).join("\n");
    await Share.share({ message: `Nigeria emergency contacts\n\n${body}` });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.backButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.shareButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={shareContacts}
            activeOpacity={0.85}
          >
            <Feather name="share-2" size={17} color={colors.primary} />
            <Text style={[styles.shareText, { color: colors.primary }]}>
              Share
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.hero, { backgroundColor: "#C0392B" }]}>
          <View style={styles.heroIcon}>
            <Feather name="life-buoy" size={34} color="#fff" />
          </View>
          <Text style={styles.heroKicker}>PUBLIC SAFETY</Text>
          <Text style={styles.heroTitle}>Emergency contacts</Text>
          <Text style={styles.heroText}>
            Fast access to verified national response lines for citizens and
            field officers in urgent situations.
          </Text>
          <View style={styles.criticalRow}>
            {criticalContacts.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={styles.criticalPill}
                onPress={() => callNumber(contact.number)}
                activeOpacity={0.85}
              >
                <Text style={styles.criticalNumber}>{contact.number}</Text>
                <Text style={styles.criticalLabel}>
                  {contact.name.replace("National ", "")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Call a response desk
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Tap to dial, or copy for radio/SMS escalation.
          </Text>
        </View>

        <View style={styles.contactList}>
          {EMERGENCY_CONTACTS.map((contact) => {
            const meta = TYPE_META[contact.type];
            return (
              <View
                key={contact.id}
                style={[
                  styles.contactCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.contactIcon,
                    { backgroundColor: meta.color + "18" },
                  ]}
                >
                  <Feather name={meta.icon} size={22} color={meta.color} />
                </View>
                <View style={styles.contactBody}>
                  <View style={styles.contactTopRow}>
                    <Text style={[styles.contactName, { color: colors.text }]}>
                      {contact.name}
                    </Text>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: meta.color + "14" },
                      ]}
                    >
                      <Text
                        style={[styles.priorityText, { color: meta.color }]}
                      >
                        {contact.priority}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.agency, { color: colors.mutedForeground }]}
                  >
                    {contact.agency}
                  </Text>
                  <Text
                    style={[
                      styles.description,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {contact.description}
                  </Text>
                  <View style={styles.availabilityRow}>
                    <Feather
                      name="clock"
                      size={13}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.availability,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {contact.availability}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        styles.callButton,
                        { backgroundColor: meta.color },
                      ]}
                      onPress={() => callNumber(contact.number)}
                      activeOpacity={0.85}
                    >
                      <Feather name="phone" size={16} color="#fff" />
                      <Text style={styles.callText}>Call {contact.number}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.copyButton,
                        { borderColor: colors.border },
                      ]}
                      onPress={() => copyNumber(contact)}
                      activeOpacity={0.85}
                    >
                      <Feather
                        name={copiedId === contact.id ? "check" : "copy"}
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.checklistCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.checklistTitleRow}>
            <Feather name="check-circle" size={20} color={colors.primary} />
            <Text style={[styles.checklistTitle, { color: colors.text }]}>
              Before responders arrive
            </Text>
          </View>
          {SAFETY_CHECKLIST.map((item, index) => (
            <View key={item} style={styles.checkItem}>
              <View
                style={[
                  styles.checkNumber,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Text
                  style={[styles.checkNumberText, { color: colors.primary }]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[styles.checkText, { color: colors.mutedForeground }]}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 18 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shareText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hero: { borderRadius: 24, padding: 20, gap: 8, overflow: "hidden" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroKicker: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.68)",
    letterSpacing: 1.4,
  },
  heroTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  heroText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 21,
  },
  criticalRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  criticalPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  criticalNumber: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  criticalLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.72)",
    marginTop: 2,
  },
  sectionHeader: { gap: 3 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  contactList: { gap: 12 },
  contactCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  contactIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contactBody: { flex: 1, gap: 4 },
  contactTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  contactName: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold" },
  priorityBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  agency: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  description: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  availability: { fontSize: 11, fontFamily: "Inter_500Medium" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  callButton: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  callText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  copyButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  checklistTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checklistTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  checkItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  checkNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkNumberText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  checkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
