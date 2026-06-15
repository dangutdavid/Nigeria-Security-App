import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

import { useColors } from "@/hooks/useColors";
import {
  CitizenIncidentReceipt,
  CitizenIncidentType,
  findCitizenIncidentByReference,
  formatCitizenAgencyLabel,
  formatCitizenIncidentStatus,
  getCitizenReportCoordinatesText,
  getCitizenReportLocationText,
  getCitizenStatusMessage,
} from "@/services/citizenIncidentApi";

const INCIDENT_TYPE_LABELS: Record<CitizenIncidentType, string> = {
  road_crash: "Road Crash",
  traffic_obstruction: "Traffic Obstruction",
  dangerous_driving: "Dangerous Driving",
  vehicle_breakdown: "Vehicle Breakdown",
  road_hazard: "Road Hazard",
  vehicle_theft: "Vehicle Theft Referral",
  theft: "Theft",
  robbery: "Robbery",
  assault: "Assault",
  missing_vehicle_alert: "Missing Vehicle Alert",
  security_incident: "Security Incident",
  crime: "Crime",
  fire_rescue: "Fire / Rescue",
  disaster_response: "Disaster Response",
  public_threat: "Public Threat",
  crowd_control: "Crowd Control",
  infrastructure_risk: "Infrastructure Risk",
  suspicious_activity: "Suspicious Activity",
  civil_emergency: "Civil Emergency",
  community_safety: "Community Safety",
  security_support_referral: "Security Support Referral",
  vehicle_issue: "Unsafe Vehicle",
  roadworthiness_complaint: "Roadworthiness Complaint",
  dangerous_vehicle: "Dangerous Vehicle",
  vehicle_inspection_concern: "Vehicle Inspection Concern",
  invalid_certificate_concern: "Invalid Certificate Concern",
  commercial_vehicle_safety_issue: "Commercial Vehicle Safety Issue",
  vehicle_documentation_concern: "Vehicle Documentation Concern",
  medical: "Medical Emergency",
  other: "Other",
};

export default function TrackReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reference, setReference] = useState("");
  const [report, setReport] = useState<CitizenIncidentReceipt | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  async function handleSearch() {
    const normalized = reference.trim().toUpperCase();
    if (!normalized) {
      setError("Enter your report reference number.");
      setReport(null);
      setSearched(false);
      return;
    }

    setSearching(true);
    setError("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await findCitizenIncidentByReference(normalized);
      setReport(result);
      setSearched(true);
      if (result) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Track Report</Text>
          <Text style={styles.headerSub}>Check citizen incident status</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.searchIconWrap}>
            <Feather name="search" size={24} color="#0F4C81" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Enter report reference</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Use the reference number shown after submitting your citizen incident report.
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, borderColor: error ? "#C0392B" : colors.border, color: colors.text }]}
            value={reference}
            onChangeText={(value) => {
              setReference(value.toUpperCase());
              setError("");
            }}
            placeholder="Example: CIR-ABC123"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.searchButton, searching && { opacity: 0.7 }]}
            onPress={handleSearch}
            disabled={searching}
            activeOpacity={0.86}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="file-text" size={18} color="#fff" />
                <Text style={styles.searchText}>Find Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {searched && !report ? (
          <View style={[styles.notFoundCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.notFoundIcon}>
              <Feather name="alert-circle" size={30} color="#C0392B" />
            </View>
            <Text style={[styles.notFoundTitle, { color: colors.text }]}>Report not found</Text>
            <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
              No citizen incident report exists for that reference number. Check the code and try again.
            </Text>
          </View>
        ) : null}

        {report ? <ReportDetails report={report} colors={colors} /> : null}

        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/")}>
          <Feather name="home" size={17} color="#0F4C81" />
          <Text style={styles.homeText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReportDetails({
  report,
  colors,
}: {
  report: CitizenIncidentReceipt;
  colors: ReturnType<typeof useColors>;
}) {
  const submittedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(report.submittedAt));
  const coordinates = getCitizenReportCoordinatesText(report);
  const area = [report.lga, report.state].filter(Boolean).join(", ");

  return (
    <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.detailHeader}>
        <View style={styles.detailIcon}>
          <Feather name="check-circle" size={24} color="#1B5E3B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>Report Found</Text>
          <Text style={[styles.detailSub, { color: colors.mutedForeground }]}>
            {getCitizenStatusMessage(report.status)}
          </Text>
        </View>
      </View>

      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>{formatCitizenIncidentStatus(report.status)}</Text>
      </View>

      <View style={styles.infoList}>
        <InfoRow label="Reference number" value={report.reference} />
        <InfoRow label="Incident type" value={INCIDENT_TYPE_LABELS[report.incidentType]} />
        <InfoRow label="Submitted" value={submittedAt} />
        <InfoRow label="Suggested agency" value={formatCitizenAgencyLabel(report.suggestedAgency)} />
        <InfoRow label="Emergency level" value={report.emergencyLevel.toUpperCase()} />
        <InfoRow label="Current status" value={formatCitizenIncidentStatus(report.status)} />
        <InfoRow label="Location" value={getCitizenReportLocationText(report)} />
        {area ? <InfoRow label="Area" value={area} /> : null}
        {coordinates ? <InfoRow label="Coordinates" value={coordinates} /> : null}
        <InfoRow label="Location source" value={report.locationSource === "gps" ? "GPS captured" : "Manual location"} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: "#0F4C81",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  headerTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 22 },
  headerSub: { color: "rgba(255,255,255,0.72)", fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 },
  scroll: { padding: 16, gap: 16 },
  searchCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 },
  searchIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#0F4C8118",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 20 },
  subtitle: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  errorText: { color: "#C0392B", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  searchButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#0F4C81",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  searchText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  notFoundCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 10 },
  notFoundIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#FEE8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  notFoundText: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19, textAlign: "center" },
  detailCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 16 },
  detailHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  detailIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  detailSub: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19, marginTop: 3 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#0F4C8118",
    borderColor: "#0F4C8140",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  statusPillText: { color: "#0F4C81", fontFamily: "Inter_700Bold", fontSize: 12 },
  infoList: { gap: 11 },
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(107,114,128,0.18)",
    paddingTop: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  infoLabel: { color: "#6B7280", fontFamily: "Inter_600SemiBold", fontSize: 12, flex: 0.9 },
  infoValue: { color: "#111827", fontFamily: "Inter_700Bold", fontSize: 12, textAlign: "right", flex: 1.1 },
  homeButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0F4C8140",
    backgroundColor: "#0F4C8112",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  homeText: { color: "#0F4C81", fontFamily: "Inter_700Bold", fontSize: 15 },
});
