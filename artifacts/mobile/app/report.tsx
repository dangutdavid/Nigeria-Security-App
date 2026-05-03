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
import { useIncidents, IncidentType, SeverityLevel, Vehicle, Victim, Incident } from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";
import { NIGERIA_STATE_LGAS } from "@/data/nigeriaLGAs";

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

const TYPE_SEVERITY_MAP: Record<IncidentType, SeverityLevel[]> = {
  crash: ["fatal", "serious", "minor", "property_only"],
  breakdown: ["minor", "property_only"],
  hazard: ["serious", "minor", "property_only"],
  flooding: ["fatal", "serious", "minor", "property_only"],
};

const TYPE_SEVERITY_HINT: Record<IncidentType, string> = {
  crash: "Select the highest level of injury sustained",
  breakdown: "Breakdowns usually involve minor injury or property damage",
  hazard: "Pick the risk level this hazard created",
  flooding: "Pick the impact level caused by the flooding",
};

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
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
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

  async function pickFromGallery() {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Gallery selection is not supported on web.");
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Gallery permission is required to attach photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.75 });
      if (!result.canceled && result.assets[0]) {
        const combined = [...new Set([...form.evidence, result.assets[0].uri])];
        update({ evidence: combined });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Failed to open photo library.");
    }
  }

  async function takePhoto() {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Camera is not supported on web.");
      return;
    }
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
    }
  }

  return null;
}
