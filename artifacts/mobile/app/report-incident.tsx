import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  BuiltInCitizenAgencyRoute,
  CitizenAgencyRoute,
  CitizenEmergencyLevel,
  CitizenLocationSource,
  CitizenIncidentReceipt,
  CitizenIncidentType,
  formatCitizenAgencyLabel,
  submitCitizenIncidentMock,
} from "@/services/citizenIncidentApi";

const INCIDENT_TYPES: Array<{
  value: CitizenIncidentType;
  label: string;
  agency: BuiltInCitizenAgencyRoute;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { value: "road_crash", label: "Road Crash", agency: "frsc", icon: "truck" },
  { value: "traffic_obstruction", label: "Traffic Obstruction", agency: "frsc", icon: "slash" },
  { value: "dangerous_driving", label: "Dangerous Driving", agency: "frsc", icon: "alert-triangle" },
  { value: "vehicle_breakdown", label: "Vehicle Breakdown", agency: "frsc", icon: "tool" },
  { value: "road_hazard", label: "Road Hazard", agency: "frsc", icon: "alert-circle" },
  { value: "vehicle_theft", label: "Vehicle Theft", agency: "police", icon: "radio" },
  { value: "crime", label: "Crime", agency: "police", icon: "shield" },
  { value: "theft", label: "Theft", agency: "police", icon: "archive" },
  { value: "robbery", label: "Robbery", agency: "police", icon: "alert-octagon" },
  { value: "assault", label: "Assault", agency: "police", icon: "user-x" },
  { value: "missing_vehicle_alert", label: "Missing Vehicle", agency: "police", icon: "search" },
  { value: "security_incident", label: "Security Incident", agency: "police", icon: "shield" },
  { value: "fire_rescue", label: "Fire / Rescue", agency: "civil_defence", icon: "alert-octagon" },
  { value: "disaster_response", label: "Disaster Response", agency: "civil_defence", icon: "cloud-lightning" },
  { value: "public_threat", label: "Public Threat", agency: "civil_defence", icon: "alert-triangle" },
  { value: "crowd_control", label: "Crowd Control", agency: "civil_defence", icon: "users" },
  { value: "infrastructure_risk", label: "Infrastructure Risk", agency: "civil_defence", icon: "home" },
  { value: "suspicious_activity", label: "Suspicious Activity", agency: "police", icon: "eye" },
  { value: "civil_emergency", label: "Civil Emergency", agency: "civil_defence", icon: "life-buoy" },
  { value: "community_safety", label: "Community Safety", agency: "civil_defence", icon: "shield" },
  { value: "security_support_referral", label: "Security Support", agency: "civil_defence", icon: "git-pull-request" },
  { value: "vehicle_issue", label: "Unsafe Vehicle", agency: "vio", icon: "clipboard" },
  { value: "roadworthiness_complaint", label: "Roadworthiness Complaint", agency: "vio", icon: "clipboard" },
  { value: "dangerous_vehicle", label: "Dangerous Vehicle", agency: "vio", icon: "alert-triangle" },
  { value: "vehicle_inspection_concern", label: "Inspection Concern", agency: "vio", icon: "check-square" },
  { value: "invalid_certificate_concern", label: "Invalid Certificate", agency: "vio", icon: "award" },
  { value: "commercial_vehicle_safety_issue", label: "Commercial Vehicle Safety", agency: "vio", icon: "truck" },
  { value: "vehicle_documentation_concern", label: "Vehicle Documentation", agency: "vio", icon: "file-text" },
  { value: "medical", label: "Medical Emergency", agency: "civil_defence", icon: "heart" },
  { value: "other", label: "Other", agency: "civil_defence", icon: "more-horizontal" },
];

const EMERGENCY_LEVELS: Array<{
  value: CitizenEmergencyLevel;
  label: string;
  color: string;
}> = [
  { value: "low", label: "Low", color: "#2E7D52" },
  { value: "medium", label: "Medium", color: "#C8960C" },
  { value: "high", label: "High", color: "#D35400" },
  { value: "critical", label: "Critical", color: "#C0392B" },
];

const AGENCY_LABELS: Record<BuiltInCitizenAgencyRoute, string> = {
  frsc: "FRSC",
  police: "Nigeria Police",
  vio: "VIO",
  civil_defence: "Civil Defence",
};

type Errors = Partial<Record<
  "incidentType" | "description" | "location" | "emergencyLevel" | "suggestedAgency",
  string
>>;

export default function CitizenIncidentReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [incidentType, setIncidentType] = useState<CitizenIncidentType | "">("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [locationState, setLocationState] = useState("");
  const [locationLga, setLocationLga] = useState("");
  const [locationSource, setLocationSource] = useState<CitizenLocationSource>("manual");
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [locationMessage, setLocationMessage] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [emergencyLevel, setEmergencyLevel] = useState<CitizenEmergencyLevel | "">("");
  const [agencyOverride, setAgencyOverride] = useState<BuiltInCitizenAgencyRoute | "">("");
  const [errors, setErrors] = useState<Errors>({});
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<CitizenIncidentReceipt | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const suggestedAgency = useMemo<BuiltInCitizenAgencyRoute | "">(() => {
    if (agencyOverride) return agencyOverride;
    return INCIDENT_TYPES.find((type) => type.value === incidentType)?.agency ?? "";
  }, [agencyOverride, incidentType]);

  async function captureLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationSource("manual");
        setLocationMessage("GPS permission was denied. You can still continue by typing the nearest street, landmark, state, or LGA.");
        setErrors((next) => ({ ...next, location: "Location permission was denied. Type your location manually." }));
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(current.coords.latitude);
      setLongitude(current.coords.longitude);
      setAccuracy(current.coords.accuracy ?? undefined);
      setLocationSource("gps");

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const stateName = geo?.region ?? "";
      const lgaName = geo?.subregion || geo?.district || geo?.city || "";
      setLocationState(stateName);
      setLocationLga(lgaName);
      const parts = geo ? [geo.street, geo.district, geo.city, geo.region].filter(Boolean) : [];
      setLocation(parts.length > 0 ? parts.join(", ") : `${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`);
      setLocationMessage("GPS location captured. You can refine the text field with a landmark if needed.");
      setErrors((next) => ({ ...next, location: undefined }));
    } catch {
      setLocationSource("manual");
      setLocationMessage("GPS could not be captured. Type the closest landmark or address to continue.");
      setErrors((next) => ({ ...next, location: "Could not capture your location. Type the nearest landmark instead." }));
    } finally {
      setLocating(false);
    }
  }

  async function pickPhoto(source: "camera" | "library") {
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to attach an image.");
      return;
    }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [4, 3] });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function validate() {
    const next: Errors = {};
    if (!incidentType) next.incidentType = "Choose the type of incident.";
    if (!description.trim() || description.trim().length < 12) {
      next.description = "Describe what happened in at least 12 characters.";
    }
    if (!location.trim()) next.location = "Capture or type the incident location.";
    if (!emergencyLevel) next.emergencyLevel = "Select the emergency level.";
    if (!suggestedAgency) next.suggestedAgency = "Choose a receiving agency.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await submitCitizenIncidentMock({
        incidentType: incidentType as CitizenIncidentType,
        description: description.trim(),
        location: location.trim(),
        latitude,
        longitude,
        address: location.trim(),
        state: locationState.trim() || undefined,
        lga: locationLga.trim() || undefined,
        locationSource,
        accuracy,
        photoUri,
        vehicleRegistration: vehicleRegistration.trim().toUpperCase() || undefined,
        emergencyLevel: emergencyLevel as CitizenEmergencyLevel,
        suggestedAgency: suggestedAgency as CitizenAgencyRoute,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReceipt(result);
    } catch {
      Alert.alert("Submission failed", "Your incident report could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.successWrap, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.successIcon, { backgroundColor: "#E8F8EE" }]}>
            <Feather name="check-circle" size={46} color="#1B5E3B" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Incident Report Submitted</Text>
          <Text style={styles.reference}>{receipt.reference}</Text>
          <Text style={[styles.successText, { color: colors.mutedForeground }]}>
            Your report has been routed to {formatCitizenAgencyLabel(receipt.suggestedAgency)} for review.
          </Text>
          <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ReceiptRow label="Emergency level" value={receipt.emergencyLevel.toUpperCase()} />
            <ReceiptRow label="Location" value={receipt.location} />
            {receipt.state || receipt.lga ? (
              <ReceiptRow label="Area" value={[receipt.lga, receipt.state].filter(Boolean).join(", ")} />
            ) : null}
            <ReceiptRow label="Status" value="SUBMITTED" />
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.replace("/")}>
            <Feather name="home" size={17} color="#fff" />
            <Text style={styles.doneText}>Return Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
          <Text style={styles.headerTitle}>Report Incident</Text>
          <Text style={styles.headerSub}>Citizen safety report</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Incident type</Text>
          <View style={styles.typeGrid}>
            {INCIDENT_TYPES.map((item) => {
              const active = incidentType === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.typeCard,
                    { backgroundColor: active ? "#0F4C81" : colors.card, borderColor: active ? "#0F4C81" : colors.border },
                  ]}
                  onPress={() => {
                    setIncidentType(item.value);
                    setAgencyOverride("");
                    setErrors((next) => ({ ...next, incidentType: undefined, suggestedAgency: undefined }));
                  }}
                >
                  <Feather name={item.icon} size={18} color={active ? "#fff" : "#0F4C81"} />
                  <Text style={[styles.typeText, { color: active ? "#fff" : colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ErrorText message={errors.incidentType} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label="Description" required error={errors.description}>
            <TextInput
              style={[styles.textarea, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.text }]}
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                if (value.trim().length >= 12) setErrors((next) => ({ ...next, description: undefined }));
              }}
              placeholder="Tell responders what happened, who is affected, and what you can see."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </Field>

          <Field label="Location" required error={errors.location}>
            <View style={[styles.locationBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TextInput
                style={[styles.locationInput, { color: colors.text }]}
                value={location}
                onChangeText={(value) => {
                  setLocation(value);
                  if (!latitude || !longitude) setLocationSource("manual");
                  if (value.trim()) setErrors((next) => ({ ...next, location: undefined }));
                }}
                placeholder="Nearest street, landmark, area, or GPS location"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
              <TouchableOpacity style={styles.locationButton} onPress={captureLocation} disabled={locating}>
                {locating ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="crosshair" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>
            {latitude != null && longitude != null ? (
              <Text style={styles.gpsText}>
                GPS captured: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                {accuracy != null ? ` · accuracy ${Math.round(accuracy)}m` : ""}
              </Text>
            ) : null}
            {locationState || locationLga ? (
              <Text style={styles.locationMeta}>
                {[locationLga, locationState].filter(Boolean).join(", ")}
              </Text>
            ) : null}
            {locationMessage ? <Text style={styles.locationHint}>{locationMessage}</Text> : null}
          </Field>

          <Field label="Photo upload">
            {photoUri ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUri(undefined)}>
                  <Feather name="x" size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <TouchableOpacity style={[styles.photoButton, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => pickPhoto("camera")}>
                  <Feather name="camera" size={18} color="#0F4C81" />
                  <Text style={[styles.photoText, { color: colors.text }]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoButton, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => pickPhoto("library")}>
                  <Feather name="image" size={18} color="#0F4C81" />
                  <Text style={[styles.photoText, { color: colors.text }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </Field>

          <Field label="Vehicle registration number">
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.text }]}
              value={vehicleRegistration}
              onChangeText={(value) => setVehicleRegistration(value.toUpperCase())}
              placeholder="Optional, e.g. ABJ 234 KA"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </Field>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Emergency level</Text>
          <View style={styles.levelRow}>
            {EMERGENCY_LEVELS.map((level) => {
              const active = emergencyLevel === level.value;
              return (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.levelChip,
                    { backgroundColor: active ? level.color : colors.card, borderColor: active ? level.color : colors.border },
                  ]}
                  onPress={() => {
                    setEmergencyLevel(level.value);
                    setErrors((next) => ({ ...next, emergencyLevel: undefined }));
                  }}
                >
                  <Text style={[styles.levelText, { color: active ? "#fff" : colors.text }]}>{level.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ErrorText message={errors.emergencyLevel} />
        </View>

        <View style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.suggestionHeader}>
            <Feather name="send" size={18} color="#0F4C81" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.suggestionTitle, { color: colors.text }]}>Agency routing suggestion</Text>
              <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]}>
                {suggestedAgency ? `Suggested route: ${AGENCY_LABELS[suggestedAgency]}` : "Choose an incident type to suggest an agency."}
              </Text>
            </View>
          </View>
          <View style={styles.agencyRow}>
            {(Object.keys(AGENCY_LABELS) as BuiltInCitizenAgencyRoute[]).map((agency) => {
              const active = suggestedAgency === agency;
              return (
                <TouchableOpacity
                  key={agency}
                  style={[styles.agencyChip, { backgroundColor: active ? "#0F4C81" : colors.muted, borderColor: active ? "#0F4C81" : colors.border }]}
                  onPress={() => {
                    setAgencyOverride(agency);
                    setErrors((next) => ({ ...next, suggestedAgency: undefined }));
                  }}
                >
                  <Text style={[styles.agencyText, { color: active ? "#fff" : colors.text }]}>{AGENCY_LABELS[agency]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ErrorText message={errors.suggestedAgency} />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.86}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="upload-cloud" size={18} color="#fff" />
              <Text style={styles.submitText}>Submit Incident Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      {children}
      <ErrorText message={error} />
    </View>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue}>{value}</Text>
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
  section: { gap: 10 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: {
    width: "47.9%",
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: "space-between",
  },
  typeText: { fontFamily: "Inter_700Bold", fontSize: 13, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#4B5563" },
  required: { color: "#C0392B" },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: "Inter_500Medium", fontSize: 15 },
  textarea: { minHeight: 118, borderWidth: 1, borderRadius: 12, padding: 14, fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 21 },
  locationBox: { borderWidth: 1, borderRadius: 12, paddingLeft: 14, flexDirection: "row", alignItems: "center", minHeight: 58 },
  locationInput: { flex: 1, paddingVertical: 12, fontFamily: "Inter_500Medium", fontSize: 15, minHeight: 56 },
  locationButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#0F4C81",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  gpsText: { color: "#1B5E3B", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  locationMeta: { color: "#0F4C81", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  locationHint: { color: "#6B7280", fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 17 },
  photoActions: { flexDirection: "row", gap: 10 },
  photoButton: { flex: 1, minHeight: 64, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6 },
  photoText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  photoWrap: { position: "relative", borderRadius: 14, overflow: "hidden" },
  photo: { width: "100%", height: 190, borderRadius: 14 },
  removePhoto: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#C0392B",
    alignItems: "center",
    justifyContent: "center",
  },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  levelChip: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 12 },
  levelText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  suggestionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  suggestionHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  suggestionTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  suggestionSub: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  agencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  agencyChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  agencyText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  errorText: { color: "#C0392B", fontFamily: "Inter_600SemiBold", fontSize: 12, lineHeight: 17 },
  submitButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#0F4C81",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  submitText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  successWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  successIcon: { width: 86, height: 86, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 23, textAlign: "center" },
  reference: { color: "#0F4C81", fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 12, letterSpacing: 1 },
  successText: { fontFamily: "Inter_500Medium", fontSize: 15, textAlign: "center", lineHeight: 22, marginTop: 12 },
  receiptCard: { alignSelf: "stretch", borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 22, gap: 12 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  receiptLabel: { color: "#6B7280", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  receiptValue: { color: "#111827", flex: 1, textAlign: "right", fontFamily: "Inter_700Bold", fontSize: 12 },
  doneButton: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 15,
    paddingHorizontal: 22,
    backgroundColor: "#0F4C81",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  doneText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});
