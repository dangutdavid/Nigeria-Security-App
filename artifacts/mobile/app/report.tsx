import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import {
  useIncidents,
  IncidentType,
  SeverityLevel,
  Vehicle,
  Victim,
  Incident,
} from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";

const TOTAL_STEPS = 5;
type Step = 1 | 2 | 3 | 4 | 5;

interface FormState {
  type: IncidentType | null;
  severity: SeverityLevel | null;
  location: string;
  lga: string;
  state: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  vehicles: Vehicle[];
  victims: Victim[];
  evidence: string[];
  notes: string;
}

const INCIDENT_TYPES: Array<{ value: IncidentType; label: string; icon: string; color: string }> = [
  { value: "crash", label: "Road Crash", icon: "alert-triangle", color: "#C0392B" },
  { value: "breakdown", label: "Vehicle Breakdown", icon: "tool", color: "#E67E22" },
  { value: "hazard", label: "Road Hazard", icon: "alert-circle", color: "#C8960C" },
  { value: "flooding", label: "Road Flooding", icon: "droplet", color: "#2C7BE5" },
];

const SEVERITY_LEVELS: Array<{ value: SeverityLevel; label: string; desc: string; color: string }> = [
  { value: "fatal", label: "Fatal", desc: "One or more fatalities", color: "#8B0000" },
  { value: "serious", label: "Serious Injury", desc: "Hospitalisation required", color: "#E67E22" },
  { value: "minor", label: "Minor Injury", desc: "Minor injuries only", color: "#27AE60" },
  { value: "property_only", label: "Property Damage", desc: "No injuries", color: "#6B7A8A" },
];

const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

const STEP_LABELS = ["Type", "Location", "Persons", "Evidence", "Review"];

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { addIncident } = useIncidents();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({
    type: null,
    severity: null,
    location: "",
    lga: "",
    state: "FCT",
    description: "",
    latitude: null,
    longitude: null,
    gpsAccuracy: null,
    vehicles: [],
    victims: [],
    evidence: [],
    notes: "",
  });

  function update(fields: Partial<FormState>) {
    setForm((f) => ({ ...f, ...fields }));
  }

  function nextStep() {
    if (step < TOTAL_STEPS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => (s + 1) as Step);
    }
  }

  function prevStep() {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
    } else {
      router.back();
    }
  }

  function addVehicle() {
    const vehicle: Vehicle = { id: Date.now().toString(), plate: "", make: "", model: "", colour: "", type: "car" };
    update({ vehicles: [...form.vehicles, vehicle] });
  }
  function updateVehicle(id: string, fields: Partial<Vehicle>) {
    update({ vehicles: form.vehicles.map((v) => (v.id === id ? { ...v, ...fields } : v)) });
  }
  function removeVehicle(id: string) {
    update({ vehicles: form.vehicles.filter((v) => v.id !== id) });
  }
  function addVictim() {
    const victim: Victim = { id: Date.now().toString(), name: "", age: "", gender: "unknown", condition: "injured" };
    update({ victims: [...form.victims, victim] });
  }
  function updateVictim(id: string, fields: Partial<Victim>) {
    update({ victims: form.victims.map((v) => (v.id === id ? { ...v, ...fields } : v)) });
  }
  function removeVictim(id: string) {
    update({ victims: form.victims.filter((v) => v.id !== id) });
  }
  function removeEvidence(uri: string) {
    update({ evidence: form.evidence.filter((e) => e !== uri) });
  }

  async function submit() {
    if (!form.type || !form.severity || !form.location) {
      Alert.alert("Incomplete", "Please fill in all required fields.");
      return;
    }

    const id = `INC-${new Date().getFullYear()}-${(Date.now() % 100000).toString().padStart(3, "0")}`;
    const lat = form.latitude ?? 9.0765 + (Math.random() - 0.5) * 2;
    const lon = form.longitude ?? 7.3986 + (Math.random() - 0.5) * 2;

    const incident: Incident = {
      id,
      type: form.type,
      severity: form.severity,
      status: "submitted",
      title: `${INCIDENT_TYPES.find((t) => t.value === form.type)?.label} — ${form.location}`,
      location: form.location,
      lga: form.lga,
      state: form.state,
      latitude: lat,
      longitude: lon,
      dateTime: new Date().toISOString(),
      description: form.description,
      vehicles: form.vehicles,
      victims: form.victims,
      evidence: form.evidence,
      reportedBy: user?.id || "",
      reportedByName: user?.name || "",
      timeline: [
        {
          id: "t-init",
          action: "Incident reported",
          by: user?.name || "",
          timestamp: new Date().toISOString(),
        },
        ...(form.evidence.length > 0
          ? [{ id: "t-ev", action: `${form.evidence.length} evidence item(s) attached`, by: user?.name || "", timestamp: new Date().toISOString() }]
          : []),
      ],
      pendingSync: false,
    };

    await addIncident(incident);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Report Submitted", `Incident ${id} has been recorded.`, [
      { text: "View Case", onPress: () => router.replace(`/case/${id}` as any) },
      { text: "Done", onPress: () => router.replace("/(tabs)/") },
    ]);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const canProceed = step === 1
    ? !!form.type && !!form.severity
    : step === 2
    ? !!form.location
    : true;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={prevStep} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Report Incident</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Step {step} of {TOTAL_STEPS}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[styles.progressBar, { backgroundColor: colors.primary, width: `${(step / TOTAL_STEPS) * 100}%` }]}
          />
        </View>

        <View style={styles.stepLabels}>
          {STEP_LABELS.map((label, i) => (
            <Text
              key={label}
              style={[
                styles.stepLabel,
                {
                  color: i + 1 <= step ? colors.primary : colors.mutedForeground,
                  fontFamily: i + 1 === step ? "Inter_700Bold" : "Inter_400Regular",
                },
              ]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && <Step1 colors={colors} form={form} update={update} />}
        {step === 2 && <Step2 colors={colors} form={form} update={update} />}
        {step === 3 && (
          <Step3
            colors={colors}
            form={form}
            addVehicle={addVehicle}
            updateVehicle={updateVehicle}
            removeVehicle={removeVehicle}
            addVictim={addVictim}
            updateVictim={updateVictim}
            removeVictim={removeVictim}
            update={update}
          />
        )}
        {step === 4 && <Step4Evidence colors={colors} form={form} update={update} removeEvidence={removeEvidence} />}
        {step === 5 && <Step5Review colors={colors} form={form} />}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 10 },
        ]}
      >
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canProceed ? colors.primary : colors.muted }]}
            onPress={nextStep}
            disabled={!canProceed}
          >
            <Text style={[styles.nextBtnText, { color: canProceed ? "#fff" : colors.mutedForeground }]}>
              Continue
            </Text>
            <Feather name="arrow-right" size={18} color={canProceed ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={submit}>
            <Feather name="send" size={18} color="#fff" />
            <Text style={[styles.nextBtnText, { color: "#fff" }]}>Submit Report</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Step1({ colors, form, update }: any) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>INCIDENT TYPE</Text>
      <View style={{ gap: 10 }}>
        {INCIDENT_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[
              s.optionCard,
              { borderColor: form.type === t.value ? t.color : colors.border, backgroundColor: form.type === t.value ? t.color + "12" : colors.card },
            ]}
            onPress={() => update({ type: t.value, severity: null })}
            activeOpacity={0.75}
          >
            <View style={[s.optionIcon, { backgroundColor: t.color + "18" }]}>
              <Feather name={t.icon as any} size={24} color={t.color} />
            </View>
            <Text style={[s.optionLabel, { color: colors.text }]}>{t.label}</Text>
            {form.type === t.value && <Feather name="check-circle" size={20} color={t.color} />}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>SEVERITY</Text>
      <View style={{ gap: 8 }}>
        {SEVERITY_LEVELS.map((sev) => (
          <TouchableOpacity
            key={sev.value}
            style={[
              s.sevCard,
              { borderColor: form.severity === sev.value ? sev.color : colors.border, backgroundColor: form.severity === sev.value ? sev.color + "12" : colors.card },
            ]}
            onPress={() => update({ severity: sev.value })}
            activeOpacity={0.75}
          >
            <View style={[s.sevDot, { backgroundColor: sev.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.sevLabel, { color: colors.text }]}>{sev.label}</Text>
              <Text style={[s.sevDesc, { color: colors.mutedForeground }]}>{sev.desc}</Text>
            </View>
            {form.severity === sev.value && <Feather name="check-circle" size={20} color={sev.color} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Step2({ colors, form, update }: any) {
  const [locating, setLocating] = useState(false);

  async function getGPSLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to auto-detect coordinates.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      update({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        gpsAccuracy: loc.coords.accuracy ? Math.round(loc.coords.accuracy) : null,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("GPS Error", "Unable to retrieve your location. Please enter it manually.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>LOCATION DETAILS</Text>

      {/* GPS capture */}
      <View style={[s.gpsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          {form.latitude && form.longitude ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Feather name="crosshair" size={13} color={colors.primary} />
                <Text style={[s.gpsLabel, { color: colors.primary }]}>GPS Captured</Text>
                {form.gpsAccuracy && (
                  <Text style={[s.gpsAccuracy, { color: colors.mutedForeground }]}>
                    ±{form.gpsAccuracy}m
                  </Text>
                )}
              </View>
              <Text style={[s.gpsCoords, { color: colors.text }]}>
                {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
              </Text>
            </>
          ) : (
            <>
              <Text style={[s.gpsLabel, { color: colors.mutedForeground }]}>GPS Coordinates</Text>
              <Text style={[s.gpsCoords, { color: colors.mutedForeground, fontSize: 12 }]}>
                Not captured — tap to auto-detect
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={[s.gpsBtn, { backgroundColor: form.latitude ? colors.primary + "18" : colors.primary, opacity: locating ? 0.6 : 1 }]}
          onPress={getGPSLocation}
          disabled={locating}
        >
          <Feather name={locating ? "loader" : "navigation"} size={16} color={form.latitude ? colors.primary : "#fff"} />
          <Text style={[s.gpsBtnText, { color: form.latitude ? colors.primary : "#fff" }]}>
            {locating ? "Locating…" : form.latitude ? "Refresh" : "Use GPS"}
          </Text>
        </TouchableOpacity>
      </View>

      <FieldInput
        colors={colors}
        label="Location Description *"
        placeholder="e.g. Km 12, Lagos–Ibadan Expressway, near Sagamu"
        value={form.location}
        onChangeText={(t: string) => update({ location: t })}
        multiline
      />
      <View>
        <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>State</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {NIGERIA_STATES.map((st) => (
            <TouchableOpacity
              key={st}
              style={[s.stateChip, { backgroundColor: form.state === st ? colors.primary : colors.muted, borderColor: form.state === st ? colors.primary : colors.border }]}
              onPress={() => update({ state: st })}
            >
              <Text style={[s.stateChipText, { color: form.state === st ? "#fff" : colors.mutedForeground }]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FieldInput
        colors={colors}
        label="LGA"
        placeholder="Local Government Area"
        value={form.lga}
        onChangeText={(t: string) => update({ lga: t })}
      />

      <FieldInput
        colors={colors}
        label="Description"
        placeholder="Briefly describe what happened…"
        value={form.description}
        onChangeText={(t: string) => update({ description: t })}
        multiline
        rows={4}
      />
    </View>
  );
}

function Step3({ colors, form, addVehicle, updateVehicle, removeVehicle, addVictim, updateVictim, removeVictim, update }: any) {
  const VEHICLE_TYPES = ["car", "truck", "bus", "motorcycle", "other"];
  const VICTIM_CONDITIONS = [
    { value: "deceased", label: "Deceased", color: "#8B0000" },
    { value: "critical", label: "Critical", color: "#C0392B" },
    { value: "injured", label: "Injured", color: "#E67E22" },
    { value: "unhurt", label: "Unhurt", color: "#27AE60" },
  ];

  return (
    <View style={{ gap: 20 }}>
      {/* Vehicles */}
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>VEHICLES ({form.vehicles.length})</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary }]} onPress={addVehicle}>
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>
        {form.vehicles.length === 0 && (
          <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>Tap "Add" to log vehicle details</Text>
        )}
        {form.vehicles.map((v: Vehicle) => (
          <View key={v.id} style={[s.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={[s.subCardTitle, { color: colors.text }]}>Vehicle</Text>
              <TouchableOpacity onPress={() => removeVehicle(v.id)}>
                <Feather name="trash-2" size={16} color={colors.fatal} />
              </TouchableOpacity>
            </View>
            <FieldInput colors={colors} label="Plate Number" placeholder="e.g. ABC-123-FG" value={v.plate} onChangeText={(t: string) => updateVehicle(v.id, { plate: t })} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><FieldInput colors={colors} label="Make" placeholder="e.g. Toyota" value={v.make} onChangeText={(t: string) => updateVehicle(v.id, { make: t })} /></View>
              <View style={{ flex: 1 }}><FieldInput colors={colors} label="Model" placeholder="e.g. Camry" value={v.model} onChangeText={(t: string) => updateVehicle(v.id, { model: t })} /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><FieldInput colors={colors} label="Colour" placeholder="e.g. White" value={v.colour} onChangeText={(t: string) => updateVehicle(v.id, { colour: t })} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                  {VEHICLE_TYPES.map((vt) => (
                    <TouchableOpacity key={vt} style={[s.miniChip, { backgroundColor: v.type === vt ? colors.primary : colors.muted, borderColor: v.type === vt ? colors.primary : colors.border }]} onPress={() => updateVehicle(v.id, { type: vt })}>
                      <Text style={[s.miniChipText, { color: v.type === vt ? "#fff" : colors.mutedForeground }]}>{vt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Victims */}
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>VICTIMS ({form.victims.length})</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.fatal + "18", borderColor: colors.fatal }]} onPress={addVictim}>
            <Feather name="plus" size={16} color={colors.fatal} />
            <Text style={[s.addBtnText, { color: colors.fatal }]}>Add</Text>
          </TouchableOpacity>
        </View>
        {form.victims.length === 0 && (
          <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>Tap "Add" to log victim information</Text>
        )}
        {form.victims.map((v: Victim) => (
          <View key={v.id} style={[s.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={[s.subCardTitle, { color: colors.text }]}>Victim</Text>
              <TouchableOpacity onPress={() => removeVictim(v.id)}><Feather name="trash-2" size={16} color={colors.fatal} /></TouchableOpacity>
            </View>
            <FieldInput colors={colors} label="Name (if known)" placeholder="Full name or 'Unknown'" value={v.name} onChangeText={(t: string) => updateVictim(v.id, { name: t })} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><FieldInput colors={colors} label="Age" placeholder="e.g. 35" value={v.age} onChangeText={(t: string) => updateVictim(v.id, { age: t })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Gender</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  {["male", "female", "unknown"].map((g) => (
                    <TouchableOpacity key={g} style={[s.miniChip, { backgroundColor: v.gender === g ? colors.primary : colors.muted, borderColor: v.gender === g ? colors.primary : colors.border }]} onPress={() => updateVictim(v.id, { gender: g })}>
                      <Text style={[s.miniChipText, { color: v.gender === g ? "#fff" : colors.mutedForeground }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Condition</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {VICTIM_CONDITIONS.map((c) => (
                <TouchableOpacity key={c.value} style={[s.miniChip, { backgroundColor: v.condition === c.value ? c.color : colors.muted, borderColor: v.condition === c.value ? c.color : colors.border }]} onPress={() => updateVictim(v.id, { condition: c.value as any })}>
                  <Text style={[s.miniChipText, { color: v.condition === c.value ? "#fff" : colors.mutedForeground }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FieldInput colors={colors} label="Hospital (if admitted)" placeholder="Hospital name" value={v.hospital || ""} onChangeText={(t: string) => updateVictim(v.id, { hospital: t })} />
          </View>
        ))}
      </View>

      {/* Notes */}
      <FieldInput colors={colors} label="Additional Notes" placeholder="Any other relevant observations…" value={form.notes} onChangeText={(t: string) => update({ notes: t })} multiline rows={3} />
    </View>
  );
}

function Step4Evidence({ colors, form, update, removeEvidence }: any) {
  const [picking, setPicking] = useState(false);

  async function pickFromGallery() {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Image picking is not supported on web.");
      return;
    }
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Media library permission is required to attach photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.75,
        selectionLimit: 10,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uris = result.assets.map((a) => a.uri);
        const combined = [...new Set([...form.evidence, ...uris])];
        update({ evidence: combined });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Failed to open gallery.");
    } finally {
      setPicking(false);
    }
  }

  async function takePhoto() {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Camera is not supported on web.");
      return;
    }
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.75 });
      if (!result.canceled && result.assets[0]) {
        const combined = [...new Set([...form.evidence, result.assets[0].uri])];
        update({ evidence: combined });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Failed to open camera.");
    } finally {
      setPicking(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>EVIDENCE & PHOTOS</Text>

      <View style={[s.evidenceInfo, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
        <Feather name="camera" size={14} color={colors.info} />
        <Text style={[s.evidenceInfoText, { color: colors.info }]}>
          Attach photos from the scene — crash damage, road conditions, vehicles, tyre marks. These are stored with the report.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
          style={[s.evidencePickBtn, { backgroundColor: colors.primary, flex: 1, opacity: picking ? 0.6 : 1 }]}
          onPress={takePhoto}
          disabled={picking}
        >
          <Feather name="camera" size={18} color="#fff" />
          <Text style={[s.evidencePickBtnText, { color: "#fff" }]}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.evidencePickBtn, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5, flex: 1, opacity: picking ? 0.6 : 1 }]}
          onPress={pickFromGallery}
          disabled={picking}
        >
          <Feather name="image" size={18} color={colors.primary} />
          <Text style={[s.evidencePickBtnText, { color: colors.primary }]}>From Gallery</Text>
        </TouchableOpacity>
      </View>

      {form.evidence.length === 0 ? (
        <View style={[s.evidenceEmpty, { borderColor: colors.border }]}>
          <Feather name="image" size={32} color={colors.mutedForeground} />
          <Text style={[s.evidenceEmptyText, { color: colors.mutedForeground }]}>
            No evidence attached yet
          </Text>
          <Text style={[s.evidenceEmptyHint, { color: colors.mutedForeground }]}>
            Evidence is optional — you can submit without photos
          </Text>
        </View>
      ) : (
        <>
          <Text style={[s.evidenceCount, { color: colors.mutedForeground }]}>
            {form.evidence.length} photo{form.evidence.length > 1 ? "s" : ""} attached
          </Text>
          <View style={s.evidenceGrid}>
            {form.evidence.map((uri: string, idx: number) => (
              <View key={uri} style={s.evidenceThumbWrap}>
                <Image source={{ uri }} style={s.evidenceThumb} resizeMode="cover" />
                <View style={[s.evidenceThumbOverlay, { backgroundColor: "rgba(0,0,0,0.02)" }]}>
                  <Text style={s.evidenceThumbIdx}>#{idx + 1}</Text>
                </View>
                <TouchableOpacity
                  style={s.evidenceRemoveBtn}
                  onPress={() => removeEvidence(uri)}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function Step5Review({ colors, form }: any) {
  const typeInfo = INCIDENT_TYPES.find((t) => t.value === form.type);
  const sevInfo = SEVERITY_LEVELS.find((sv) => sv.value === form.severity);

  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>REVIEW BEFORE SUBMITTING</Text>

      <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ReviewRow label="Type" value={typeInfo?.label || "—"} colors={colors} />
        <ReviewRow label="Severity" value={sevInfo?.label || "—"} colors={colors} valueColor={sevInfo?.color} />
        <ReviewRow label="Location" value={form.location || "—"} colors={colors} />
        <ReviewRow label="State" value={form.state || "—"} colors={colors} />
        <ReviewRow
          label="GPS"
          value={form.latitude ? `${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}` : "Not captured"}
          colors={colors}
          valueColor={form.latitude ? colors.primary : colors.mutedForeground}
        />
        <ReviewRow label="Vehicles" value={`${form.vehicles.length} logged`} colors={colors} />
        <ReviewRow label="Victims" value={`${form.victims.length} logged`} colors={colors} />
        <ReviewRow
          label="Evidence"
          value={form.evidence.length > 0 ? `${form.evidence.length} photo${form.evidence.length > 1 ? "s" : ""}` : "None"}
          colors={colors}
          last
        />
      </View>

      {form.description ? (
        <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>DESCRIPTION</Text>
          <Text style={{ color: colors.text, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 }}>
            {form.description}
          </Text>
        </View>
      ) : null}

      {form.evidence.length > 0 && (
        <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>EVIDENCE PREVIEW</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {form.evidence.map((uri: string, i: number) => (
              <View key={uri}>
                <Image source={{ uri }} style={s.reviewThumb} resizeMode="cover" />
                <Text style={[s.reviewThumbIdx, { color: colors.mutedForeground }]}>#{i + 1}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[s.infoBox, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
        <Feather name="info" size={16} color={colors.info} />
        <Text style={[s.infoText, { color: colors.info }]}>
          This report will be saved immediately. If offline, it will be queued for sync when connectivity is restored.
        </Text>
      </View>
    </View>
  );
}

function ReviewRow({ label, value, colors, valueColor, last }: any) {
  return (
    <View style={[s.reviewRow, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.reviewValue, { color: valueColor || colors.text }]}>{value}</Text>
    </View>
  );
}

function FieldInput({ colors, label, placeholder, value, onChangeText, multiline, rows, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[s.textInput, { borderColor: colors.border, backgroundColor: colors.muted, color: colors.text, height: multiline ? (rows || 3) * 24 + 16 : 46 }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 4 },
  optionCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1.5, gap: 14 },
  optionIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optionLabel: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sevCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  sevDot: { width: 14, height: 14, borderRadius: 7 },
  sevLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sevDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  stateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  stateChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", marginBottom: 8 },
  subCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  subCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  miniChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  miniChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  reviewCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", padding: 14 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  reviewLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  reviewValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", maxWidth: "60%" },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  gpsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  gpsLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  gpsAccuracy: { fontSize: 11, fontFamily: "Inter_400Regular" },
  gpsCoords: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  gpsBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  evidenceInfo: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  evidenceInfoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  evidencePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  evidencePickBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  evidenceEmpty: {
    alignItems: "center",
    padding: 32,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    gap: 8,
  },
  evidenceEmptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  evidenceEmptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  evidenceCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  evidenceThumbWrap: { width: 100, height: 100, borderRadius: 10, overflow: "hidden" },
  evidenceThumb: { width: "100%", height: "100%" },
  evidenceThumbOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 4 },
  evidenceThumbIdx: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  evidenceRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewThumb: { width: 90, height: 90, borderRadius: 10 },
  reviewThumbIdx: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 3 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  progressTrack: { height: 4, borderRadius: 2, marginBottom: 10, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 2 },
  stepLabels: { flexDirection: "row", justifyContent: "space-between" },
  stepLabel: { fontSize: 10, textAlign: "center", flex: 1 },
  scroll: { flex: 1 },
  footer: { borderTopWidth: 1, padding: 16 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
