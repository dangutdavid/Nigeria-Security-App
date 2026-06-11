import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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
import { useTheftReports } from "@/context/TheftReportContext";

const COLORS_LIST = [
  "Black", "White", "Silver", "Grey", "Blue", "Red",
  "Green", "Brown", "Gold", "Yellow", "Orange", "Maroon",
];

const MAKES = [
  "Toyota", "Honda", "Hyundai", "Kia", "Nissan", "Mercedes-Benz",
  "BMW", "Lexus", "Ford", "Chevrolet", "Volkswagen", "Innoson",
  "Peugeot", "Suzuki", "Mitsubishi", "Other",
];

export default function ReportTheftScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addReport, requestLocationPermission } = useTheftReports();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [reporterName, setReporterName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<{ plate: string; id: string; reference: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  async function detectLocation() {
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert("Location needed", "Please enable location permissions to auto-detect your location.");
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        const parts = [geo.street, geo.district, geo.city, geo.region].filter(Boolean);
        setLocation(parts.join(", "));
      }
    } catch {
      Alert.alert("Location error", "Could not detect your location. Please type it manually.");
    } finally {
      setLocating(false);
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to photos to attach an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function validateStep1() {
    if (!plate.trim()) { Alert.alert("Required", "Please enter the vehicle registration number."); return false; }
    if (!make.trim()) { Alert.alert("Required", "Please select the vehicle make."); return false; }
    if (!color.trim()) { Alert.alert("Required", "Please select the vehicle colour."); return false; }
    return true;
  }

  function validateStep2() {
    if (!location.trim()) { Alert.alert("Required", "Please enter or detect the location of the theft."); return false; }
    if (!description.trim()) { Alert.alert("Required", "Please provide a brief description."); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    setSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const report = await addReport({
        plate: plate.trim().toUpperCase(),
        make: make.trim(),
        model: model.trim(),
        color,
        year: year.trim(),
        description: description.trim(),
        photoUri,
        location: location.trim(),
        latitude,
        longitude,
        reporterName: reporterName.trim() || "Anonymous",
        contactPhone: contactPhone.trim(),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmittedReport({ plate: report.plate, id: report.id, reference: report.reference });
      setSubmitted(true);
    } catch {
      Alert.alert("Error", "Could not submit your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && submittedReport) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingTop: topPad }}>
          <View style={[styles.successIcon, { backgroundColor: "#E8F8EE" }]}>
            <Feather name="check-circle" size={48} color="#1B5E3B" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Report Submitted!</Text>
          <Text style={[styles.successPlate, { color: "#C0392B" }]}>{submittedReport.plate}</Text>
          <View style={{ alignSelf: "stretch", borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14, alignItems: "center", backgroundColor: colors.card, borderColor: colors.border }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, color: colors.mutedForeground }}>YOUR CASE REFERENCE</Text>
            <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 1, marginTop: 6, color: colors.text }}>{submittedReport.reference}</Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6, color: colors.mutedForeground }}>Save this number — use it to track your report status anytime.</Text>
          </View>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Nearby users are being alerted now. The alert radius will expand over the next few hours to reach more people.
          </Text>
          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.successRow}>
              <Feather name="radio" size={14} color="#1B5E3B" />
              <Text style={[styles.successRowText, { color: colors.text }]}>Within 2 miles — alerted immediately</Text>
            </View>
            <View style={styles.successRow}>
              <Feather name="radio" size={14} color="#E67E22" />
              <Text style={[styles.successRowText, { color: colors.text }]}>Within 5 miles — after 30 minutes</Text>
            </View>
            <View style={styles.successRow}>
              <Feather name="radio" size={14} color="#C0392B" />
              <Text style={[styles.successRowText, { color: colors.text }]}>Within 10 miles — after 2 hours</Text>
            </View>
            <View style={styles.successRow}>
              <Feather name="radio" size={14} color="#8B0000" />
              <Text style={[styles.successRowText, { color: colors.text }]}>Within 20 miles — after 6 hours</Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch", borderWidth: 1.5, borderColor: "#C0392B", borderRadius: 14, paddingVertical: 13, marginBottom: 10 }}
            onPress={() =>
              router.push({ pathname: "/track-report", params: { ref: submittedReport.reference } } as any)
            }
            activeOpacity={0.85}
          >
            <Feather name="search" size={16} color="#C0392B" />
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#C0392B" }}>Track This Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: "#C0392B" }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Feather name="arrow-left" size={16} color="#fff" />
            <Text style={styles.doneBtnText}>Done</Text>
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: "#C0392B", paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as 1 | 2 | 3))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Report Stolen Vehicle</Text>
            <Text style={styles.headerSub}>Step {step} of 3</Text>
          </View>
          <View style={styles.stepIndicator}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[styles.stepDot, { backgroundColor: s <= step ? "#fff" : "rgba(255,255,255,0.3)" }]}
              />
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIconWrap, { backgroundColor: "#FEE8E8" }]}>
                <Feather name="truck" size={22} color="#C0392B" />
              </View>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Vehicle Details</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Enter the details of the stolen vehicle</Text>
            </View>

            <View style={[styles.plateWrap, { backgroundColor: "#FFF8DC", borderColor: "#C8960C" }]}>
              <Text style={styles.plateLabel}>REGISTRATION NUMBER</Text>
              <TextInput
                style={styles.plateInput}
                value={plate}
                onChangeText={(t) => setPlate(t.toUpperCase())}
                placeholder="e.g. AGL 234 KJ"
                placeholderTextColor="#C8960C99"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Field label="Make / Brand" required>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {MAKES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, { backgroundColor: make === m ? "#C0392B" : colors.muted, borderColor: make === m ? "#C0392B" : colors.border }]}
                      onPress={() => setMake(m)}
                    >
                      <Text style={[styles.chipText, { color: make === m ? "#fff" : colors.text }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {make === "Other" && (
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted, marginTop: 8 }]}
                    placeholder="Enter make..."
                    placeholderTextColor={colors.mutedForeground}
                  />
                )}
              </Field>

              <Field label="Model">
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={model}
                  onChangeText={setModel}
                  placeholder="e.g. Camry, Accord, Corolla..."
                  placeholderTextColor={colors.mutedForeground}
                />
              </Field>

              <Field label="Colour" required>
                <View style={styles.colourGrid}>
                  {COLORS_LIST.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colourChip, { backgroundColor: color === c ? "#C0392B" : colors.muted, borderColor: color === c ? "#C0392B" : colors.border }]}
                      onPress={() => setColor(c)}
                    >
                      <Text style={[styles.colourChipText, { color: color === c ? "#fff" : colors.text }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>

              <Field label="Year (optional)">
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={year}
                  onChangeText={setYear}
                  placeholder="e.g. 2020"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </Field>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIconWrap, { backgroundColor: "#FEE8E8" }]}>
                <Feather name="map-pin" size={22} color="#C0392B" />
              </View>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Theft Details</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Where and what happened?</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Field label="Location of Theft" required>
                <View style={[styles.locRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                  <TextInput
                    style={[styles.locInput, { color: colors.text }]}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Street, area, or landmark..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.gpsBtn, { backgroundColor: "#C0392B" }]}
                    onPress={detectLocation}
                    disabled={locating}
                  >
                    {locating
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Feather name="crosshair" size={16} color="#fff" />}
                  </TouchableOpacity>
                </View>
                {latitude != null && (
                  <View style={styles.coordRow}>
                    <Feather name="check-circle" size={12} color="#1B5E3B" />
                    <Text style={[styles.coordText, { color: "#1B5E3B" }]}>
                      GPS captured: {latitude.toFixed(5)}, {longitude?.toFixed(5)}
                    </Text>
                  </View>
                )}
              </Field>

              <Field label="What happened?" required>
                <TextInput
                  style={[styles.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe how the vehicle was stolen, any suspects, direction of travel..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </Field>

              <Field label="Vehicle Photo (optional)">
                {photoUri ? (
                  <View style={styles.photoWrap}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                    <TouchableOpacity
                      style={[styles.removePhotoBtn, { backgroundColor: "#C0392B" }]}
                      onPress={() => setPhotoUri(undefined)}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoRow}>
                    <TouchableOpacity
                      style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                      onPress={takePhoto}
                    >
                      <Feather name="camera" size={20} color="#C0392B" />
                      <Text style={[styles.photoBtnText, { color: colors.text }]}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                      onPress={pickPhoto}
                    >
                      <Feather name="image" size={20} color="#C0392B" />
                      <Text style={[styles.photoBtnText, { color: colors.text }]}>From Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Field>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIconWrap, { backgroundColor: "#FEE8E8" }]}>
                <Feather name="user" size={22} color="#C0392B" />
              </View>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Your Details</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Optional — helps FRSC officers follow up with you</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Field label="Your Name (optional)">
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={reporterName}
                  onChangeText={setReporterName}
                  placeholder="Anonymous if left blank"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Contact Phone (optional)">
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="e.g. 08012345678"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </Field>
            </View>

            {/* Summary card */}
            <View style={[styles.summaryCard, { backgroundColor: "#FEE8E8", borderColor: "#C0392B30" }]}>
              <Text style={styles.summaryTitle}>Report Summary</Text>
              <View style={[styles.plateBadge, { borderColor: "#C8960C" }]}>
                <Text style={styles.plateBadgeText}>{plate || "—"}</Text>
              </View>
              <Text style={[styles.summaryLine, { color: "#C0392B" }]}>
                {[color, make, model, year].filter(Boolean).join(" · ") || "Vehicle details not complete"}
              </Text>
              <Text style={[styles.summaryLoc, { color: "#333" }]}>
                <Feather name="map-pin" size={11} /> {location || "Location not set"}
              </Text>
            </View>

            <View style={[styles.broadcastInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="radio" size={16} color="#1B5E3B" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.broadcastTitle, { color: colors.text }]}>Broadcast Alert</Text>
                <Text style={[styles.broadcastSub, { color: colors.mutedForeground }]}>
                  Nearby app users will receive an immediate alert. The radius expands from 2 miles to 20 miles over 6 hours.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Navigation */}
        <View style={styles.navRow}>
          {step < 3 ? (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: "#C0392B" }]}
              onPress={() => {
                if (step === 1 && !validateStep1()) return;
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep((s) => (s + 1) as 1 | 2 | 3);
                setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Next</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: "#C0392B" }, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : (<><Feather name="send" size={18} color="#fff" /><Text style={styles.nextBtnText}>Submit Report & Broadcast Alert</Text></>)}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}{required ? <Text style={{ color: "#C0392B" }}> *</Text> : ""}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", marginTop: 2 },
  stepIndicator: { flexDirection: "row", gap: 5 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  scroll: { padding: 16, gap: 12 },
  stepHeader: { alignItems: "center", paddingVertical: 8 },
  stepIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  stepTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  plateWrap: { borderWidth: 2, borderRadius: 14, padding: 14, alignItems: "center" },
  plateLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#C8960C", letterSpacing: 1.2, marginBottom: 6 },
  plateInput: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#C8960C", textAlign: "center", minWidth: 220 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_500Medium" },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  colourGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colourChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  colourChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  locRow: { flexDirection: "row", alignItems: "flex-start", borderWidth: 1, borderRadius: 12, paddingLeft: 14, paddingVertical: 4, gap: 8 },
  locInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 10, minHeight: 48 },
  gpsBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", margin: 4 },
  coordRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  coordText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  photoRow: { flexDirection: "row", gap: 12 },
  photoBtn: { flex: 1, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  photoBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  photoWrap: { position: "relative" },
  photoPreview: { width: "100%", height: 180, borderRadius: 12 },
  removePhotoBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  summaryCard: { borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center", gap: 6 },
  summaryTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#C0392B", textTransform: "uppercase", letterSpacing: 1 },
  plateBadge: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#FFF8DC" },
  plateBadgeText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#C8960C" },
  summaryLine: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  summaryLoc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  broadcastInfo: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  broadcastTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  broadcastSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  navRow: { marginTop: 8 },
  nextBtn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 8 },
  successPlate: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 12 },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 24, lineHeight: 22 },
  successCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginBottom: 24 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  successRowText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  doneBtn: { height: 52, width: "100%", borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  doneBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
