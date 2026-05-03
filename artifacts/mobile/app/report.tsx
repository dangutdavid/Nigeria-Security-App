import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
  getProbableCauseLibrary,
  groupProbableCauses,
  IncidentStatus,
  IncidentType,
  ProbableCause,
  SeverityLevel,
  Vehicle,
  Victim,
  useIncidents,
} from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";
import { NIGERIA_STATE_LGAS } from "@/data/nigeriaLGAs";

type Step = 1 | 2 | 3 | 4 | 5;
const TOTAL_STEPS = 5;
const STEP_LABELS = ["Type", "Location", "Causes", "Evidence", "Review"];

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

const TYPE_SEVERITY_MAP: Record<IncidentType, SeverityLevel[]> = {
  crash: ["fatal", "serious", "minor", "property_only"],
  breakdown: ["minor", "property_only"],
  hazard: ["serious", "minor", "property_only"],
  flooding: ["fatal", "serious", "minor", "property_only"],
};

const TYPE_SEVERITY_HINT: Record<IncidentType, string> = {
  crash: "Select the highest level of injury sustained.",
  breakdown: "Breakdowns usually involve minor injury or property damage.",
  hazard: "Pick the risk level this hazard created.",
  flooding: "Pick the impact level caused by the flooding.",
};

const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

interface FormState {
  type: IncidentType | null;
  severity: SeverityLevel | null;
  state: string;
  lga: string;
  location: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  probableCauses: ProbableCause[];
  vehicles: Vehicle[];
  victims: Victim[];
  evidence: string[];
  notes: string;
}

function FieldInput({ colors, label, value, onChangeText, placeholder, multiline, rows }: any) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        numberOfLines={rows}
        style={[
          s.input,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.border,
            minHeight: multiline ? 96 : 48,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}

function StepPill({ label, active, colors }: { label: string; active: boolean; colors: any }) {
  return (
    <View style={[s.stepPill, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}>
      <Text style={[s.stepPillText, { color: active ? "#fff" : colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { addIncident } = useIncidents();

  const [step, setStep] = useState<Step>(1);
  const [lgaSearch, setLgaSearch] = useState("");
  const [form, setForm] = useState<FormState>({
    type: null,
    severity: null,
    state: "FCT",
    lga: "",
    location: "",
    description: "",
    latitude: null,
    longitude: null,
    gpsAccuracy: null,
    probableCauses: [],
    vehicles: [],
    victims: [],
    evidence: [],
    notes: "",
  });

  const selectedLgas = useMemo(() => NIGERIA_STATE_LGAS.find((s) => s.name === form.state)?.lgas ?? [], [form.state]);
  const filteredLgas = useMemo(() => selectedLgas.filter((l) => !lgaSearch || l.toLowerCase().includes(lgaSearch.toLowerCase())), [selectedLgas, lgaSearch]);
  const allowedSeverities = form.type ? TYPE_SEVERITY_MAP[form.type] : [];
  const probableCauseGroups = groupProbableCauses(form.type);

  function update(fields: Partial<FormState>) {
    setForm((f) => ({ ...f, ...fields }));
  }

  function pickType(type: IncidentType) {
    update({ type, severity: null, probableCauses: [] });
  }

  function pickSeverity(severity: SeverityLevel) {
    if (form.type && !TYPE_SEVERITY_MAP[form.type].includes(severity)) return;
    update({ severity });
  }

  function toggleProbableCause(item: ProbableCause) {
    const exists = form.probableCauses.some((cause) => cause.code === item.code);
    update({ probableCauses: exists ? form.probableCauses.filter((cause) => cause.code !== item.code) : [...form.probableCauses, item] });
  }

  async function useGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location denied", "Enable location permission to detect the incident area.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo?.region) {
        const detectedState = NIGERIA_STATES.find((s) => s.toLowerCase() === geo.region?.toLowerCase()) ?? form.state;
        const matchLga = selectedLgas.find((l) => geo.subregion?.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes((geo.subregion ?? "").toLowerCase()));
        update({ state: detectedState, lga: matchLga ?? form.lga, latitude: pos.coords.latitude, longitude: pos.coords.longitude, gpsAccuracy: pos.coords.accuracy ?? null });
        if (detectedState !== form.state) setLgaSearch("");
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("GPS error", "Could not detect your location.");
    }
  }

  async function pickPhoto(useCamera: boolean) {
    if (Platform.OS === "web") {
      Alert.alert("Not available", useCamera ? "Camera is not supported on web." : "Photo library is not supported on web.");
      return;
    }
    const permission = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission denied", "Please allow access to attach evidence photos.");
      return;
    }
    const result = useCamera ? await ImagePicker.launchCameraAsync({ quality: 0.75 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.75 });
    if (!result.canceled && result.assets[0]) {
      update({ evidence: [...new Set([...form.evidence, result.assets[0].uri])] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  function removeEvidence(uri: string) {
    update({ evidence: form.evidence.filter((e) => e !== uri) });
  }

  function addVehicle() {
    update({ vehicles: [...form.vehicles, { id: Date.now().toString(), plate: "", make: "", model: "", colour: "", type: "car" }] });
  }

  function updateVehicle(id: string, fields: Partial<Vehicle>) {
    update({ vehicles: form.vehicles.map((v) => (v.id === id ? { ...v, ...fields } : v)) });
  }

  function removeVehicle(id: string) {
    update({ vehicles: form.vehicles.filter((v) => v.id !== id) });
  }

  function addVictim() {
    update({ victims: [...form.victims, { id: Date.now().toString(), name: "", age: "", gender: "unknown", condition: "injured" }] });
  }

  function updateVictim(id: string, fields: Partial<Victim>) {
    update({ victims: form.victims.map((v) => (v.id === id ? { ...v, ...fields } : v)) });
  }

  function removeVictim(id: string) {
    update({ victims: form.victims.filter((v) => v.id !== id) });
  }

  function prevStep() {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
  }

  function nextStep() {
    if (step < TOTAL_STEPS) setStep((s) => (s + 1) as Step);
  }

  function canContinue() {
    if (step === 1) return !!form.type && !!form.severity;
    if (step === 2) return !!form.state && !!form.lga && !!form.location;
    return true;
  }

  function submit() {
    if (!user || !form.type || !form.severity) return;
    const incident = {
      id: `INC-${Date.now()}`,
      title: `${form.type.toUpperCase()} - ${form.location || form.lga || form.state}`,
      type: form.type,
      severity: form.severity,
      status: "submitted" as IncidentStatus,
      reportedBy: user.id,
      reportedByName: user.name,
      location: form.location || form.lga || form.state,
      state: form.state,
      lga: form.lga,
      description: form.description,
      probableCauses: form.probableCauses,
      latitude: form.latitude ?? 0,
      longitude: form.longitude ?? 0,
      gpsAccuracy: form.gpsAccuracy,
      vehicles: form.vehicles,
      victims: form.victims,
      evidence: form.evidence,
      notes: form.notes,
      dateTime: new Date().toISOString(),
      timeline: [{ id: `TL-${Date.now()}`, action: "Incident reported", by: user.name, timestamp: new Date().toISOString() }],
      pendingSync: false,
    } as any;
    void addIncident(incident);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)/cases");
  }

  const topPad = insets.top + (Platform.OS === "web" ? 20 : 0);
  const bottomPad = insets.bottom + 24;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}> 
      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.card }]}> 
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[s.title, { color: colors.text }]}>Report Incident</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Step {step} of {TOTAL_STEPS}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
          {STEP_LABELS.map((label) => <StepPill key={`${label}`} label={label} active={step === STEP_LABELS.indexOf(label) + 1} colors={colors} />)}
        </ScrollView>

        {step === 1 && (
          <View style={{ gap: 16 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>INCIDENT TYPE</Text>
            <View style={s.cardGrid}>
              {INCIDENT_TYPES.map((item) => {
                const active = form.type === item.value;
                return (
                  <TouchableOpacity key={item.value} style={[s.typeCard, { backgroundColor: active ? item.color : colors.card, borderColor: active ? item.color : colors.border }]} onPress={() => pickType(item.value)}>
                    <Feather name={item.icon as any} size={20} color={active ? "#fff" : item.color} />
                    <Text style={[s.typeLabel, { color: active ? "#fff" : colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.type ? (
              <View style={{ gap: 10 }}>
                <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>SEVERITY</Text>
                <Text style={[s.helper, { color: colors.mutedForeground }]}>{TYPE_SEVERITY_HINT[form.type]}</Text>
                {SEVERITY_LEVELS.filter((sev) => allowedSeverities.includes(sev.value)).map((sev) => {
                  const active = form.severity === sev.value;
                  return (
                    <TouchableOpacity key={sev.value} style={[s.severityRow, { backgroundColor: active ? sev.color : colors.card, borderColor: active ? sev.color : colors.border }]} onPress={() => pickSeverity(sev.value)}>
                      <View style={[s.dot, { backgroundColor: active ? "#fff" : sev.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.rowTitle, { color: active ? "#fff" : colors.text }]}>{sev.label}</Text>
                        <Text style={[s.rowSub, { color: active ? "rgba(255,255,255,0.85)" : colors.mutedForeground }]}>{sev.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 16 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>LOCATION DETAILS</Text>
            <TouchableOpacity style={[s.gpsBtn, { backgroundColor: colors.primary }]} onPress={useGps}>
              <Feather name="navigation" size={14} color="#fff" />
              <Text style={s.gpsBtnText}>Use My Location</Text>
            </TouchableOpacity>

            <View>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>State</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {NIGERIA_STATES.map((st) => (
                  <TouchableOpacity key={st} style={[s.chip, { backgroundColor: form.state === st ? colors.primary : colors.muted, borderColor: form.state === st ? colors.primary : colors.border }]} onPress={() => update({ state: st, lga: "" })}>
                    <Text style={[s.chipText, { color: form.state === st ? "#fff" : colors.mutedForeground }]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>LGA</Text>
              <View style={[s.searchBox, { borderColor: colors.border, backgroundColor: colors.muted }]}> 
                <Feather name="search" size={13} color={colors.mutedForeground} />
                <TextInput value={lgaSearch} onChangeText={setLgaSearch} placeholder={`Search ${selectedLgas.length} LGAs…`} placeholderTextColor={colors.mutedForeground} style={[s.searchInput, { color: colors.text }]} />
                {lgaSearch ? <TouchableOpacity onPress={() => setLgaSearch("")}><Feather name="x" size={13} color={colors.mutedForeground} /></TouchableOpacity> : null}
              </View>
              {form.lga ? (
                <TouchableOpacity style={[s.selected, { borderColor: colors.primary, backgroundColor: colors.primary + "15" }]} onPress={() => update({ lga: "" })}>
                  <Feather name="map-pin" size={13} color={colors.primary} />
                  <Text style={[s.selectedText, { color: colors.primary }]}>{form.lga}</Text>
                  <Feather name="x" size={13} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                {filteredLgas.map((lga) => {
                  const active = form.lga === lga;
                  return (
                    <TouchableOpacity key={lga} style={[s.chip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]} onPress={() => update({ lga })}>
                      <Text style={[s.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>{lga}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <FieldInput colors={colors} label="Location" value={form.location} onChangeText={(location: string) => update({ location })} placeholder="Road, landmark, junction…" />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PEOPLE & VEHICLES</Text>

            <View style={[s.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Text style={[s.blockTitle, { color: colors.text }]}>Vehicles</Text>
                <TouchableOpacity onPress={addVehicle}>
                  <Text style={[s.linkText, { color: colors.primary }]}>Add vehicle</Text>
                </TouchableOpacity>
              </View>
              {form.vehicles.length === 0 ? (
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>No vehicles added yet.</Text>
              ) : (
                form.vehicles.map((vehicle) => (
                  <View key={vehicle.id} style={[s.entryCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={[s.entryTitle, { color: colors.text }]}>Vehicle</Text>
                      <TouchableOpacity onPress={() => removeVehicle(vehicle.id)}>
                        <Feather name="trash-2" size={14} color={colors.fatal} />
                      </TouchableOpacity>
                    </View>
                    <FieldInput colors={colors} label="Plate" value={vehicle.plate} onChangeText={(plate: string) => updateVehicle(vehicle.id, { plate })} placeholder="ABC 123 XY" />
                    <View style={s.twoCol}>
                      <FieldInput colors={colors} label="Make" value={vehicle.make} onChangeText={(make: string) => updateVehicle(vehicle.id, { make })} placeholder="Toyota" />
                      <FieldInput colors={colors} label="Model" value={vehicle.model} onChangeText={(model: string) => updateVehicle(vehicle.id, { model })} placeholder="Corolla" />
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={[s.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Text style={[s.blockTitle, { color: colors.text }]}>Victims / persons</Text>
                <TouchableOpacity onPress={addVictim}>
                  <Text style={[s.linkText, { color: colors.primary }]}>Add person</Text>
                </TouchableOpacity>
              </View>
              {form.victims.length === 0 ? (
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>No persons added yet.</Text>
              ) : (
                form.victims.map((victim) => (
                  <View key={victim.id} style={[s.entryCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={[s.entryTitle, { color: colors.text }]}>Person</Text>
                      <TouchableOpacity onPress={() => removeVictim(victim.id)}>
                        <Feather name="trash-2" size={14} color={colors.fatal} />
                      </TouchableOpacity>
                    </View>
                    <FieldInput colors={colors} label="Name" value={victim.name} onChangeText={(name: string) => updateVictim(victim.id, { name })} placeholder="Full name" />
                    <View style={s.twoCol}>
                      <FieldInput colors={colors} label="Age" value={victim.age} onChangeText={(age: string) => updateVictim(victim.id, { age })} placeholder="34" keyboardType="number-pad" />
                      <FieldInput colors={colors} label="Gender" value={victim.gender} onChangeText={(gender: string) => updateVictim(victim.id, { gender: gender as any })} placeholder="Male" />
                    </View>
                  </View>
                ))
              )}
            </View>

            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>POTENTIAL CAUSES</Text>
            {probableCauseGroups.map(([category, items]) => (
              <View key={category} style={[s.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.blockTitle, { color: colors.text }]}>{category === "driver" ? "Driver factors" : category === "vehicle" ? "Vehicle factors" : category === "environment" ? "Environmental factors" : category === "temporal" ? "Temporal factors" : category === "road" ? "Road factors" : "Other"}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {items.map((item) => {
                    const selected = form.probableCauses.some((cause) => cause.code === item.code);
                    return (
                      <TouchableOpacity key={item.code} onPress={() => toggleProbableCause(item)} style={[s.causeChip, { backgroundColor: selected ? colors.primary : colors.muted, borderColor: selected ? colors.primary : colors.border }]}>
                        <Text style={[s.causeCode, { color: selected ? "#fff" : colors.primary }]}>{item.code}</Text>
                        <Text style={[s.causeLabel, { color: selected ? "#fff" : colors.mutedForeground }]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 16 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>EVIDENCE</Text>
            <View style={s.evidenceRow}>
              <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => pickPhoto(true)}>
                <Feather name="camera" size={14} color="#fff" />
                <Text style={s.addBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.secondary }]} onPress={() => pickPhoto(false)}>
                <Feather name="image" size={14} color="#fff" />
                <Text style={s.addBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {form.evidence.map((uri) => (
                <View key={uri} style={[s.evidenceThumb, { borderColor: colors.border }]}> 
                  <Image source={{ uri }} style={s.evidenceImage} />
                  <TouchableOpacity style={[s.evidenceRemove, { backgroundColor: colors.fatal }]} onPress={() => removeEvidence(uri)}>
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <FieldInput colors={colors} label="Notes" value={form.notes} onChangeText={(notes: string) => update({ notes })} placeholder="Additional remarks…" multiline rows={4} />
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: 14 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>REVIEW</Text>
            <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
              <Text style={[s.reviewTitle, { color: colors.text }]}>{form.type?.toUpperCase() || "UNSET"}</Text>
              <Text style={[s.reviewLine, { color: colors.mutedForeground }]}>Severity: {form.severity || "-"}</Text>
              <Text style={[s.reviewLine, { color: colors.mutedForeground }]}>Probable causes: {form.probableCauses.length}</Text>
              <Text style={[s.reviewLine, { color: colors.mutedForeground }]}>Location: {form.location || "-"}</Text>
              <Text style={[s.reviewLine, { color: colors.mutedForeground }]}>State / LGA: {form.state} / {form.lga || "-"}</Text>
              <Text style={[s.reviewLine, { color: colors.mutedForeground }]}>Vehicles: {form.vehicles.length} • Victims: {form.victims.length} • Photos: {form.evidence.length}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}> 
        <TouchableOpacity style={[s.navBtn, { borderColor: colors.border }]} onPress={prevStep}>
          <Text style={[s.navBtnText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity style={[s.navBtn, { backgroundColor: canContinue() ? colors.primary : colors.muted, borderColor: colors.border }]} onPress={nextStep} disabled={!canContinue()}>
            <Text style={[s.navBtnText, { color: canContinue() ? "#fff" : colors.mutedForeground }]}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.navBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={submit}>
            <Text style={[s.navBtnText, { color: "#fff" }]}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  helper: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardGrid: { gap: 10 },
  typeCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  typeLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  severityRow: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  stepPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  stepPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  selected: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8, alignSelf: "flex-start" },
  selectedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  linkText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  entryCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  entryTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  twoCol: { flexDirection: "row", gap: 10 },
  gpsBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  gpsBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  block: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  blockTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  causeChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, minWidth: 120, flexGrow: 1 },
  causeCode: { fontSize: 12, fontFamily: "Inter_700Bold" },
  causeLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  evidenceRow: { flexDirection: "row", gap: 10 },
  evidenceThumb: { width: 88, height: 88, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  evidenceImage: { width: "100%", height: "100%" },
  evidenceRemove: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  reviewCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  reviewTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  reviewLine: { fontSize: 13, fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  navBtn: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  navBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
