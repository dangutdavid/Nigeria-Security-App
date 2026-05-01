import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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

const TOTAL_STEPS = 4;

type Step = 1 | 2 | 3 | 4;

interface FormState {
  type: IncidentType | null;
  severity: SeverityLevel | null;
  location: string;
  lga: string;
  state: string;
  description: string;
  vehicles: Vehicle[];
  victims: Victim[];
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
    vehicles: [],
    victims: [],
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
    const vehicle: Vehicle = {
      id: Date.now().toString(),
      plate: "",
      make: "",
      model: "",
      colour: "",
      type: "car",
    };
    update({ vehicles: [...form.vehicles, vehicle] });
  }

  function updateVehicle(id: string, fields: Partial<Vehicle>) {
    update({
      vehicles: form.vehicles.map((v) => (v.id === id ? { ...v, ...fields } : v)),
    });
  }

  function removeVehicle(id: string) {
    update({ vehicles: form.vehicles.filter((v) => v.id !== id) });
  }

  function addVictim() {
    const victim: Victim = {
      id: Date.now().toString(),
      name: "",
      age: "",
      gender: "unknown",
      condition: "injured",
    };
    update({ victims: [...form.victims, victim] });
  }

  function updateVictim(id: string, fields: Partial<Victim>) {
    update({
      victims: form.victims.map((v) => (v.id === id ? { ...v, ...fields } : v)),
    });
  }

  function removeVictim(id: string) {
    update({ victims: form.victims.filter((v) => v.id !== id) });
  }

  async function submit() {
    if (!form.type || !form.severity || !form.location) {
      Alert.alert("Incomplete", "Please fill in all required fields.");
      return;
    }

    const id = `INC-${new Date().getFullYear()}-${(Date.now() % 100000).toString().padStart(3, "0")}`;
    const incident: Incident = {
      id,
      type: form.type,
      severity: form.severity,
      status: "submitted",
      title: `${INCIDENT_TYPES.find((t) => t.value === form.type)?.label} — ${form.location}`,
      location: form.location,
      lga: form.lga,
      state: form.state,
      latitude: 9.0765 + (Math.random() - 0.5) * 2,
      longitude: 7.3986 + (Math.random() - 0.5) * 2,
      dateTime: new Date().toISOString(),
      description: form.description,
      vehicles: form.vehicles,
      victims: form.victims,
      evidence: [],
      reportedBy: user?.id || "",
      reportedByName: user?.name || "",
      timeline: [
        {
          id: "t-init",
          action: "Incident reported",
          by: user?.name || "",
          timestamp: new Date().toISOString(),
        },
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
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={prevStep} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Report Incident
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Step {step} of {TOTAL_STEPS}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: colors.primary, width: `${(step / TOTAL_STEPS) * 100}%` },
            ]}
          />
        </View>

        {/* Step labels */}
        <View style={styles.stepLabels}>
          {["Type", "Location", "Persons & Vehicles", "Review"].map((label, i) => (
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
        {step === 1 && (
          <Step1
            colors={colors}
            form={form}
            update={update}
          />
        )}
        {step === 2 && (
          <Step2
            colors={colors}
            form={form}
            update={update}
          />
        )}
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
        {step === 4 && (
          <Step4
            colors={colors}
            form={form}
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 10,
          },
        ]}
      >
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: canProceed ? colors.primary : colors.muted },
            ]}
            onPress={nextStep}
            disabled={!canProceed}
          >
            <Text
              style={[
                styles.nextBtnText,
                { color: canProceed ? "#fff" : colors.mutedForeground },
              ]}
            >
              Continue
            </Text>
            <Feather
              name="arrow-right"
              size={18}
              color={canProceed ? "#fff" : colors.mutedForeground}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={submit}
          >
            <Feather name="send" size={18} color="#fff" />
            <Text style={[styles.nextBtnText, { color: "#fff" }]}>
              Submit Report
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Step1({ colors, form, update }: any) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
        INCIDENT TYPE
      </Text>
      <View style={{ gap: 10 }}>
        {INCIDENT_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[
              s.optionCard,
              {
                borderColor: form.type === t.value ? t.color : colors.border,
                backgroundColor: form.type === t.value ? t.color + "12" : colors.card,
              },
            ]}
            onPress={() => update({ type: t.value })}
            activeOpacity={0.75}
          >
            <View style={[s.optionIcon, { backgroundColor: t.color + "18" }]}>
              <Feather name={t.icon as any} size={24} color={t.color} />
            </View>
            <Text style={[s.optionLabel, { color: colors.text }]}>{t.label}</Text>
            {form.type === t.value && (
              <Feather name="check-circle" size={20} color={t.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>
        SEVERITY
      </Text>
      <View style={{ gap: 8 }}>
        {SEVERITY_LEVELS.map((sev) => (
          <TouchableOpacity
            key={sev.value}
            style={[
              s.sevCard,
              {
                borderColor: form.severity === sev.value ? sev.color : colors.border,
                backgroundColor: form.severity === sev.value ? sev.color + "12" : colors.card,
              },
            ]}
            onPress={() => update({ severity: sev.value })}
            activeOpacity={0.75}
          >
            <View style={[s.sevDot, { backgroundColor: sev.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.sevLabel, { color: colors.text }]}>{sev.label}</Text>
              <Text style={[s.sevDesc, { color: colors.mutedForeground }]}>{sev.desc}</Text>
            </View>
            {form.severity === sev.value && (
              <Feather name="check-circle" size={20} color={sev.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Step2({ colors, form, update }: any) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
        LOCATION DETAILS
      </Text>

      <FieldInput
        colors={colors}
        label="Location Description *"
        placeholder="e.g. Km 12, Lagos–Ibadan Expressway, near Sagamu"
        value={form.location}
        onChangeText={(t: string) => update({ location: t })}
        multiline
      />
      <FieldInput
        colors={colors}
        label="LGA"
        placeholder="Local Government Area"
        value={form.lga}
        onChangeText={(t: string) => update({ lga: t })}
      />

      <View>
        <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>State</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {NIGERIA_STATES.map((st) => (
            <TouchableOpacity
              key={st}
              style={[
                s.stateChip,
                {
                  backgroundColor: form.state === st ? colors.primary : colors.muted,
                  borderColor: form.state === st ? colors.primary : colors.border,
                },
              ]}
              onPress={() => update({ state: st })}
            >
              <Text
                style={[
                  s.stateChipText,
                  { color: form.state === st ? "#fff" : colors.mutedForeground },
                ]}
              >
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            VEHICLES ({form.vehicles.length})
          </Text>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
            onPress={addVehicle}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {form.vehicles.length === 0 && (
          <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
            Tap "Add" to log vehicle details
          </Text>
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
              <View style={{ flex: 1 }}>
                <FieldInput colors={colors} label="Make" placeholder="e.g. Toyota" value={v.make} onChangeText={(t: string) => updateVehicle(v.id, { make: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldInput colors={colors} label="Model" placeholder="e.g. Camry" value={v.model} onChangeText={(t: string) => updateVehicle(v.id, { model: t })} />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <FieldInput colors={colors} label="Colour" placeholder="e.g. White" value={v.colour} onChangeText={(t: string) => updateVehicle(v.id, { colour: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                  {VEHICLE_TYPES.map((vt) => (
                    <TouchableOpacity
                      key={vt}
                      style={[s.miniChip, { backgroundColor: v.type === vt ? colors.primary : colors.muted, borderColor: v.type === vt ? colors.primary : colors.border }]}
                      onPress={() => updateVehicle(v.id, { type: vt })}
                    >
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
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            VICTIMS ({form.victims.length})
          </Text>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.fatal + "18", borderColor: colors.fatal }]}
            onPress={addVictim}
          >
            <Feather name="plus" size={16} color={colors.fatal} />
            <Text style={[s.addBtnText, { color: colors.fatal }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {form.victims.length === 0 && (
          <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
            Tap "Add" to log victim information
          </Text>
        )}

        {form.victims.map((v: Victim) => (
          <View key={v.id} style={[s.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={[s.subCardTitle, { color: colors.text }]}>Victim</Text>
              <TouchableOpacity onPress={() => removeVictim(v.id)}>
                <Feather name="trash-2" size={16} color={colors.fatal} />
              </TouchableOpacity>
            </View>
            <FieldInput colors={colors} label="Name (if known)" placeholder="Full name or 'Unknown'" value={v.name} onChangeText={(t: string) => updateVictim(v.id, { name: t })} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <FieldInput colors={colors} label="Age" placeholder="e.g. 35" value={v.age} onChangeText={(t: string) => updateVictim(v.id, { age: t })} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Gender</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  {["male", "female", "unknown"].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[s.miniChip, { backgroundColor: v.gender === g ? colors.primary : colors.muted, borderColor: v.gender === g ? colors.primary : colors.border }]}
                      onPress={() => updateVictim(v.id, { gender: g })}
                    >
                      <Text style={[s.miniChipText, { color: v.gender === g ? "#fff" : colors.mutedForeground }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Condition</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {VICTIM_CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[s.miniChip, { backgroundColor: v.condition === c.value ? c.color : colors.muted, borderColor: v.condition === c.value ? c.color : colors.border }]}
                  onPress={() => updateVictim(v.id, { condition: c.value as any })}
                >
                  <Text style={[s.miniChipText, { color: v.condition === c.value ? "#fff" : colors.mutedForeground }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FieldInput colors={colors} label="Hospital (if admitted)" placeholder="Hospital name" value={v.hospital || ""} onChangeText={(t: string) => updateVictim(v.id, { hospital: t })} />
          </View>
        ))}
      </View>

      {/* Notes */}
      <FieldInput
        colors={colors}
        label="Additional Notes"
        placeholder="Any other relevant observations…"
        value={form.notes}
        onChangeText={(t: string) => update({ notes: t })}
        multiline
        rows={3}
      />
    </View>
  );
}

function Step4({ colors, form }: any) {
  const typeInfo = INCIDENT_TYPES.find((t) => t.value === form.type);
  const sevInfo = SEVERITY_LEVELS.find((s) => s.value === form.severity);

  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
        REVIEW BEFORE SUBMITTING
      </Text>

      <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ReviewRow label="Type" value={typeInfo?.label || "—"} colors={colors} />
        <ReviewRow label="Severity" value={sevInfo?.label || "—"} colors={colors} valueColor={sevInfo?.color} />
        <ReviewRow label="Location" value={form.location || "—"} colors={colors} />
        <ReviewRow label="State" value={form.state || "—"} colors={colors} />
        <ReviewRow label="Vehicles" value={`${form.vehicles.length} logged`} colors={colors} />
        <ReviewRow label="Victims" value={`${form.victims.length} logged`} colors={colors} last />
      </View>

      {form.description ? (
        <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>
            DESCRIPTION
          </Text>
          <Text style={[{ color: colors.text, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 }]}>
            {form.description}
          </Text>
        </View>
      ) : null}

      <View style={[s.infoBox, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
        <Feather name="info" size={16} color={colors.info} />
        <Text style={[s.infoText, { color: colors.info }]}>
          This report will be submitted immediately. Ensure all details are accurate before continuing.
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
        style={[
          s.textInput,
          {
            borderColor: colors.border,
            backgroundColor: colors.muted,
            color: colors.text,
            height: multiline ? (rows || 3) * 24 + 16 : 46,
          },
        ]}
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
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 14,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sevCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  sevDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  sevLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sevDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  stateChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginBottom: 8,
  },
  subCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  subCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  miniChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    padding: 14,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  reviewLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  reviewValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
    maxWidth: "60%",
  },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepLabel: {
    fontSize: 10,
    flex: 1,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 15,
    borderRadius: 14,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
