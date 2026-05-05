import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import {
  EvidenceItem,
  Incident,
  IncidentStatus,
  Vehicle,
  Victim,
  useIncidents,
} from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_ACTIONS: Record<
  IncidentStatus,
  Array<{ label: string; next: IncidentStatus; color: string; icon: string }>
> = {
  draft: [{ label: "Submit Report", next: "submitted", color: "#2C7BE5", icon: "send" }],
  submitted: [{ label: "Assign for Review", next: "assigned", color: "#E67E22", icon: "user-check" }],
  assigned: [{ label: "Begin Review", next: "under_review", color: "#C8960C", icon: "eye" }],
  under_review: [{ label: "Close Case", next: "closed", color: "#27AE60", icon: "check-circle" }],
  closed: [],
};

const CONDITION_COLORS: Record<string, string> = {
  fatal: "#8B0000",
  critical: "#C0392B",
  injured: "#E67E22",
  unhurt: "#27AE60",
};

const SEV_LABELS: Record<string, string> = {
  fatal: "Fatal",
  serious: "Serious",
  minor: "Minor",
  property_only: "Property Only",
};

const TYPE_ICONS: Record<string, string> = {
  crash: "alert-triangle",
  breakdown: "tool",
  hazard: "alert-circle",
  flooding: "droplet",
};

const EDIT_TABS = ["Details", "Vehicles", "Persons", "Evidence"] as const;
type EditTab = (typeof EDIT_TABS)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Small reusable components ───────────────────────────────────────────────

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  colors: any;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[st.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground + "88"}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        style={[
          st.input,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.text,
            minHeight: multiline ? 90 : 46,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  colors: any;
}) {
  return (
    <View style={st.chipRow}>
      {options.map((o) => {
        const sel = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[
              st.chip,
              {
                backgroundColor: sel ? colors.primary : colors.muted,
                borderColor: sel ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                st.chipText,
                { color: sel ? "#fff" : colors.text },
              ]}
            >
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RecordCard({
  title,
  meta,
  imageUri,
  onDelete,
  onEdit,
  colors,
}: {
  title: string;
  meta: string;
  imageUri?: string;
  onDelete: () => void;
  onEdit: () => void;
  colors: any;
}) {
  return (
    <View style={[st.recordCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={st.recordThumb} resizeMode="cover" />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[st.recordTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[st.recordMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[st.iconCircle, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
      >
        <Feather name="edit-2" size={13} color={colors.primary} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[st.iconCircle, { backgroundColor: CONDITION_COLORS.fatal + "15", borderColor: CONDITION_COLORS.fatal + "30" }]}
      >
        <Feather name="trash-2" size={13} color={CONDITION_COLORS.fatal} />
      </Pressable>
    </View>
  );
}

function AddButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[st.addBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
    >
      <Feather name="plus-circle" size={16} color={colors.primary} />
      <Text style={[st.addBtnText, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Edit modal tab panels ────────────────────────────────────────────────────

function DetailsTab({
  title, setTitle, type, setType, severity, setSeverity,
  state, setState, lga, setLga, location, setLocation, description, setDescription,
  colors,
}: any) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={st.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <LabeledInput label="Case title" value={title} onChange={setTitle} colors={colors} />
      <Text style={[st.inputLabel, { color: colors.mutedForeground }]}>Incident type</Text>
      <ChipGroup
        options={["crash", "breakdown", "hazard", "flooding"] as const}
        value={type}
        onChange={setType}
        colors={colors}
      />
      <Text style={[st.inputLabel, { color: colors.mutedForeground, marginTop: 4 }]}>Severity</Text>
      <ChipGroup
        options={["fatal", "serious", "minor", "property_only"] as const}
        value={severity}
        onChange={setSeverity}
        colors={colors}
      />
      <View style={{ height: 14 }} />
      <LabeledInput label="State" value={state} onChange={setState} colors={colors} />
      <LabeledInput label="LGA" value={lga} onChange={setLga} colors={colors} />
      <LabeledInput label="Location / Road" value={location} onChange={setLocation} colors={colors} />
      <LabeledInput label="Description" value={description} onChange={setDescription} multiline colors={colors} />
    </ScrollView>
  );
}

// ─── Inline edit form wrapper ─────────────────────────────────────────────────

function InlineEditCard({
  title,
  colors,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  colors: any;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[st.inlineEditCard, { backgroundColor: colors.card, borderColor: colors.primary + "50" }]}>
      <View style={st.inlineEditHeader}>
        <View style={[st.inlineEditDot, { backgroundColor: colors.primary }]} />
        <Text style={[st.inlineEditTitle, { color: colors.primary }]}>{title}</Text>
      </View>
      {children}
      <View style={st.inlineEditActions}>
        <Pressable
          onPress={onCancel}
          style={[st.inlineEditCancelBtn, { borderColor: colors.border }]}
        >
          <Text style={[st.inlineEditCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          style={[st.inlineEditSaveBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="check" size={14} color="#fff" />
          <Text style={st.inlineEditSaveText}>Save changes</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Vehicles tab ─────────────────────────────────────────────────────────────

function VehiclesTab({
  vehicles, setVehicles,
  plate, setPlate, make, setMake, model, setModel, colour, setColour, vtype, setVtype,
  colors,
}: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ePlate, setEPlate] = useState("");
  const [eMake, setEMake] = useState("");
  const [eModel, setEModel] = useState("");
  const [eColour, setEColour] = useState("");
  const [eVtype, setEVtype] = useState<Vehicle["type"]>("car");

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setEPlate(v.plate ?? "");
    setEMake(v.make ?? "");
    setEModel(v.model ?? "");
    setEColour(v.colour ?? "");
    setEVtype(v.type ?? "car");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    if (!ePlate.trim() && !eMake.trim() && !eModel.trim()) {
      Alert.alert("Enter at least one vehicle detail");
      return;
    }
    setVehicles((prev: Vehicle[]) =>
      prev.map((v) =>
        v.id === editingId
          ? { ...v, plate: ePlate.trim(), make: eMake.trim(), model: eModel.trim(), colour: eColour.trim(), type: eVtype }
          : v
      )
    );
    setEditingId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function doAdd() {
    if (!plate.trim() && !make.trim() && !model.trim()) {
      Alert.alert("Enter at least one vehicle detail");
      return;
    }
    setVehicles((prev: Vehicle[]) => [
      ...prev,
      { id: Date.now().toString(), plate: plate.trim(), make: make.trim(), model: model.trim(), colour: colour.trim(), type: vtype },
    ]);
    setPlate(""); setMake(""); setModel(""); setColour(""); setVtype("car");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={st.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {vehicles.length === 0 ? (
        <View style={[st.emptyBox, { borderColor: colors.border }]}>
          <Feather name="truck" size={28} color={colors.mutedForeground} />
          <Text style={[st.emptyText, { color: colors.mutedForeground }]}>No vehicles recorded</Text>
        </View>
      ) : (
        vehicles.map((v: Vehicle) =>
          editingId === v.id ? (
            <InlineEditCard
              key={v.id}
              title="Editing vehicle"
              colors={colors}
              onSave={saveEdit}
              onCancel={cancelEdit}
            >
              <LabeledInput label="Plate number" value={ePlate} onChange={setEPlate} colors={colors} />
              <LabeledInput label="Make" value={eMake} onChange={setEMake} colors={colors} />
              <LabeledInput label="Model" value={eModel} onChange={setEModel} colors={colors} />
              <LabeledInput label="Colour" value={eColour} onChange={setEColour} colors={colors} />
              <Text style={[st.inputLabel, { color: colors.mutedForeground }]}>Vehicle type</Text>
              <ChipGroup
                options={["car", "truck", "bus", "motorcycle", "other"] as const}
                value={eVtype}
                onChange={setEVtype}
                colors={colors}
              />
            </InlineEditCard>
          ) : (
            <RecordCard
              key={v.id}
              title={[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
              meta={[v.plate, v.colour, v.type].filter(Boolean).join("  ·  ")}
              onEdit={() => startEdit(v)}
              onDelete={() => setVehicles((prev: Vehicle[]) => prev.filter((x) => x.id !== v.id))}
              colors={colors}
            />
          )
        )
      )}

      <View style={[st.addFormCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[st.addFormTitle, { color: colors.text }]}>Add vehicle</Text>
        <LabeledInput label="Plate number" value={plate} onChange={setPlate} colors={colors} />
        <LabeledInput label="Make" value={make} onChange={setMake} colors={colors} />
        <LabeledInput label="Model" value={model} onChange={setModel} colors={colors} />
        <LabeledInput label="Colour" value={colour} onChange={setColour} colors={colors} />
        <Text style={[st.inputLabel, { color: colors.mutedForeground }]}>Vehicle type</Text>
        <ChipGroup
          options={["car", "truck", "bus", "motorcycle", "other"] as const}
          value={vtype}
          onChange={setVtype}
          colors={colors}
        />
        <View style={{ height: 8 }} />
        <AddButton label="Add vehicle to record" onPress={doAdd} colors={colors} />
      </View>
    </ScrollView>
  );
}

// ─── Persons tab ──────────────────────────────────────────────────────────────

function PersonsTab({
  victims, setVictims,
  name, setName, age, setAge, gender, setGender, condition, setCondition, hospital, setHospital,
  colors,
}: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eAge, setEAge] = useState("");
  const [eGender, setEGender] = useState<Victim["gender"]>("unknown");
  const [eCondition, setECondition] = useState<Victim["condition"]>("injured");
  const [eHospital, setEHospital] = useState("");

  function startEdit(v: Victim) {
    setEditingId(v.id);
    setEName(v.name ?? "");
    setEAge(v.age ?? "");
    setEGender(v.gender ?? "unknown");
    setECondition(v.condition ?? "injured");
    setEHospital(v.hospital ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    if (!eName.trim() && !eAge.trim()) {
      Alert.alert("Enter at least a name or age");
      return;
    }
    setVictims((prev: Victim[]) =>
      prev.map((v) =>
        v.id === editingId
          ? { ...v, name: eName.trim(), age: eAge.trim(), gender: eGender, condition: eCondition, hospital: eHospital.trim() || undefined }
          : v
      )
    );
    setEditingId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function doAdd() {
    if (!name.trim() && !age.trim()) {
      Alert.alert("Enter at least a name or age");
      return;
    }
    setVictims((prev: Victim[]) => [
      ...prev,
      { id: Date.now().toString(), name: name.trim(), age: age.trim(), gender, condition, hospital: hospital.trim() || undefined },
    ]);
    setName(""); setAge(""); setGender("unknown"); setCondition("injured"); setHospital("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={st.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {victims.length === 0 ? (
        <View style={[st.emptyBox, { borderColor: colors.border }]}>
          <Feather name="users" size={28} color={colors.mutedForeground} />
          <Text style={[st.emptyText, { color: colors.mutedForeground }]}>No persons recorded</Text>
        </View>
      ) : (
        victims.map((v: Victim) =>
          editingId === v.id ? (
            <InlineEditCard
              key={v.id}
              title="Editing person"
              colors={colors}
              onSave={saveEdit}
              onCancel={cancelEdit}
            >
              <LabeledInput label="Name" value={eName} onChange={setEName} placeholder="Full name / Unknown" colors={colors} />
              <LabeledInput label="Age" value={eAge} onChange={setEAge} placeholder="e.g. 35 or ~30s" colors={colors} />
              <Text style={[st.inputLabel, { color: colors.mutedForeground }]}>Gender</Text>
              <ChipGroup
                options={["male", "female", "unknown"] as const}
                value={eGender}
                onChange={setEGender}
                colors={colors}
              />
              <Text style={[st.inputLabel, { color: colors.mutedForeground, marginTop: 4 }]}>Condition</Text>
              <ChipGroup
                options={["fatal", "critical", "injured", "unhurt"] as const}
                value={eCondition}
                onChange={setECondition}
                colors={colors}
              />
              <View style={{ height: 4 }} />
              <LabeledInput label="Hospital admitted" value={eHospital} onChange={setEHospital} placeholder="Hospital name (optional)" colors={colors} />
            </InlineEditCard>
          ) : (
            <RecordCard
              key={v.id}
              title={v.name || "Unknown person"}
              meta={[v.age ? `Age ${v.age}` : null, v.gender, v.condition, v.hospital ? `Hospital: ${v.hospital}` : null].filter(Boolean).join("  ·  ")}
              onEdit={() => startEdit(v)}
              onDelete={() => setVictims((prev: Victim[]) => prev.filter((x) => x.id !== v.id))}
              colors={colors}
            />
          )
        )
      )}

      <View style={[st.addFormCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[st.addFormTitle, { color: colors.text }]}>Add person</Text>
        <LabeledInput label="Name" value={name} onChange={setName} placeholder="Full name / Unknown" colors={colors} />
        <LabeledInput label="Age" value={age} onChange={setAge} placeholder="e.g. 35 or ~30s" keyboardType="default" colors={colors} />
        <Text style={[st.inputLabel, { color: colors.mutedForeground }]}>Gender</Text>
        <ChipGroup
          options={["male", "female", "unknown"] as const}
          value={gender}
          onChange={setGender}
          colors={colors}
        />
        <Text style={[st.inputLabel, { color: colors.mutedForeground, marginTop: 4 }]}>Condition</Text>
        <ChipGroup
          options={["fatal", "critical", "injured", "unhurt"] as const}
          value={condition}
          onChange={setCondition}
          colors={colors}
        />
        <View style={{ height: 8 }} />
        <LabeledInput label="Hospital admitted" value={hospital} onChange={setHospital} placeholder="Hospital name (optional)" colors={colors} />
        <AddButton label="Add person to record" onPress={doAdd} colors={colors} />
      </View>
    </ScrollView>
  );
}

// ─── Evidence tab ─────────────────────────────────────────────────────────────

function isImageUri(u: string) {
  if (!u) return false;
  if (u.startsWith("file://") || u.startsWith("ph://") || u.startsWith("content://")) return true;
  const lower = u.toLowerCase();
  return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".gif");
}

function EvidencePickerButtons({
  onPickedUri,
  colors,
}: {
  onPickedUri: (uri: string) => void;
  colors: any;
}) {
  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow access to your photo library to attach evidence photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      onPickedUri(result.assets[0].uri);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera access to capture evidence photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      onPickedUri(result.assets[0].uri);
    }
  }

  return (
    <View style={st.pickerRow}>
      <Pressable
        onPress={pickFromCamera}
        style={[st.pickerBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
      >
        <Feather name="camera" size={18} color={colors.primary} />
        <Text style={[st.pickerBtnText, { color: colors.primary }]}>Take Photo</Text>
      </Pressable>
      <Pressable
        onPress={pickFromLibrary}
        style={[st.pickerBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
      >
        <Feather name="image" size={18} color={colors.primary} />
        <Text style={[st.pickerBtnText, { color: colors.primary }]}>From Library</Text>
      </Pressable>
    </View>
  );
}

function EvidenceTab({
  evidence, setEvidence,
  uri, setUri, label, setLabel,
  colors,
}: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eUri, setEUri] = useState("");
  const [eLabel, setELabel] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  function startEdit(e: EvidenceItem) {
    setEditingId(e.id);
    setEUri(e.uri ?? "");
    setELabel(e.label ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    if (!eUri.trim()) {
      Alert.alert("No file or URL selected", "Pick a photo or paste a URL first.");
      return;
    }
    setEvidence((prev: EvidenceItem[]) =>
      prev.map((e) =>
        e.id === editingId
          ? { ...e, uri: eUri.trim(), label: eLabel.trim() || undefined }
          : e
      )
    );
    setEditingId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function doAdd() {
    if (!uri.trim()) {
      Alert.alert("No file selected", "Take a photo, choose from your library, or paste a URL.");
      return;
    }
    setEvidence((prev: EvidenceItem[]) => [
      ...prev,
      { id: Date.now().toString(), uri: uri.trim(), label: label.trim() || undefined },
    ]);
    setUri(""); setLabel(""); setShowUrlInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={st.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {evidence.length === 0 ? (
        <View style={[st.emptyBox, { borderColor: colors.border }]}>
          <Feather name="camera" size={28} color={colors.mutedForeground} />
          <Text style={[st.emptyText, { color: colors.mutedForeground }]}>No evidence attached</Text>
        </View>
      ) : (
        evidence.map((e: EvidenceItem) =>
          editingId === e.id ? (
            <InlineEditCard
              key={e.id}
              title="Editing evidence"
              colors={colors}
              onSave={saveEdit}
              onCancel={cancelEdit}
            >
              <EvidencePickerButtons onPickedUri={setEUri} colors={colors} />
              {eUri ? (
                <View style={st.previewBox}>
                  {isImageUri(eUri) ? (
                    <Image source={{ uri: eUri }} style={st.previewImage} resizeMode="cover" />
                  ) : null}
                  <Text style={[st.previewUri, { color: colors.mutedForeground }]} numberOfLines={2}>{eUri}</Text>
                  <Pressable onPress={() => setEUri("")} style={st.clearPreview}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}
              <Pressable onPress={() => {}} style={st.urlToggle}>
                <Feather name="link" size={13} color={colors.mutedForeground} />
                <Text style={[st.urlToggleText, { color: colors.mutedForeground }]}>Paste a URL instead</Text>
              </Pressable>
              <LabeledInput label="Evidence URL / reference" value={eUri} onChange={setEUri} placeholder="https://… or file reference" colors={colors} />
              <LabeledInput label="Label / description" value={eLabel} onChange={setELabel} placeholder="e.g. Scene photo 1" colors={colors} />
            </InlineEditCard>
          ) : (
            <RecordCard
              key={e.id}
              title={e.label || "Evidence item"}
              meta={isImageUri(e.uri) ? "Photo / video" : e.uri}
              imageUri={isImageUri(e.uri) ? e.uri : undefined}
              onEdit={() => startEdit(e)}
              onDelete={() => setEvidence((prev: EvidenceItem[]) => prev.filter((x) => x.id !== e.id))}
              colors={colors}
            />
          )
        )
      )}

      <View style={[st.addFormCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[st.addFormTitle, { color: colors.text }]}>Attach evidence</Text>

        <EvidencePickerButtons onPickedUri={setUri} colors={colors} />

        {uri ? (
          <View style={st.previewBox}>
            {isImageUri(uri) ? (
              <Image source={{ uri }} style={st.previewImage} resizeMode="cover" />
            ) : null}
            <Text style={[st.previewUri, { color: colors.mutedForeground }]} numberOfLines={2}>{uri}</Text>
            <Pressable onPress={() => setUri("")} style={st.clearPreview}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => setShowUrlInput((v) => !v)}
          style={st.urlToggle}
        >
          <Feather name="link" size={13} color={colors.mutedForeground} />
          <Text style={[st.urlToggleText, { color: colors.mutedForeground }]}>
            {showUrlInput ? "Hide URL field" : "Paste a URL instead"}
          </Text>
          <Feather name={showUrlInput ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
        </Pressable>

        {showUrlInput ? (
          <LabeledInput label="Evidence URL / reference" value={uri} onChange={setUri} placeholder="https://… or file reference" colors={colors} />
        ) : null}

        <LabeledInput label="Label / description" value={label} onChange={setLabel} placeholder="e.g. Scene photo 1 (optional)" colors={colors} />
        <AddButton label="Attach to record" onPress={doAdd} colors={colors} />
      </View>
    </ScrollView>
  );
}

// ─── Full-screen Edit Modal ───────────────────────────────────────────────────

function EditIncidentModal({
  visible,
  incident,
  onClose,
  onSave,
  colors,
  insets,
}: {
  visible: boolean;
  incident: Incident;
  onClose: () => void;
  onSave: (updates: Partial<Incident>) => Promise<void>;
  colors: any;
  insets: any;
}) {
  const [activeTab, setActiveTab] = useState<EditTab>("Details");

  const [title, setTitle] = useState(incident.title);
  const [type, setType] = useState(incident.type);
  const [severity, setSeverity] = useState(incident.severity);
  const [state, setState] = useState(incident.state);
  const [lga, setLga] = useState(incident.lga);
  const [location, setLocation] = useState(incident.location);
  const [description, setDescription] = useState(incident.description);

  const [vehicles, setVehicles] = useState<Vehicle[]>(incident.vehicles ?? []);
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [colour, setColour] = useState("");
  const [vtype, setVtype] = useState<Vehicle["type"]>("car");

  const [victims, setVictims] = useState<Victim[]>(incident.victims ?? []);
  const [pName, setPName] = useState("");
  const [pAge, setPAge] = useState("");
  const [pGender, setPGender] = useState<Victim["gender"]>("unknown");
  const [pCondition, setPCondition] = useState<Victim["condition"]>("injured");
  const [pHospital, setPHospital] = useState("");

  const [evidence, setEvidence] = useState<EvidenceItem[]>(incident.evidence ?? []);
  const [eUri, setEUri] = useState("");
  const [eLabel, setELabel] = useState("");

  function resetToIncident() {
    setTitle(incident.title); setType(incident.type); setSeverity(incident.severity);
    setState(incident.state); setLga(incident.lga); setLocation(incident.location);
    setDescription(incident.description);
    setVehicles(incident.vehicles ?? []); setVictims(incident.victims ?? []); setEvidence(incident.evidence ?? []);
    setActiveTab("Details");
  }

  async function handleSave() {
    await onSave({ title: title.trim(), type, severity, state: state.trim(), lga: lga.trim(), location: location.trim(), description: description.trim(), vehicles, victims, evidence });
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + 16;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[st.editRoot, { backgroundColor: colors.background, paddingTop: topPad }]}>
          {/* Header */}
          <View style={[st.editHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={() => { resetToIncident(); onClose(); }} style={st.editHeaderBtn}>
              <Text style={[st.editCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[st.editHeaderTitle, { color: colors.text }]}>Edit Incident</Text>
            <Pressable onPress={handleSave} style={[st.editSaveBtn, { backgroundColor: colors.primary }]}>
              <Text style={st.editSaveText}>Save</Text>
            </Pressable>
          </View>

          {/* Tab bar */}
          <View style={[st.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {EDIT_TABS.map((tab) => {
              const active = activeTab === tab;
              let badge = 0;
              if (tab === "Vehicles") badge = vehicles.length;
              if (tab === "Persons") badge = victims.length;
              if (tab === "Evidence") badge = evidence.length;
              return (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[st.tabItem, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}>
                  <Text style={[st.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>{tab}</Text>
                  {badge > 0 && (
                    <View style={[st.tabBadge, { backgroundColor: colors.primary }]}>
                      <Text style={st.tabBadgeText}>{badge}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Tab content */}
          <View style={{ flex: 1, paddingBottom: bottomPad }}>
            {activeTab === "Details" && (
              <DetailsTab
                title={title} setTitle={setTitle}
                type={type} setType={setType}
                severity={severity} setSeverity={setSeverity}
                state={state} setState={setState}
                lga={lga} setLga={setLga}
                location={location} setLocation={setLocation}
                description={description} setDescription={setDescription}
                colors={colors}
              />
            )}
            {activeTab === "Vehicles" && (
              <VehiclesTab
                vehicles={vehicles} setVehicles={setVehicles}
                plate={plate} setPlate={setPlate}
                make={make} setMake={setMake}
                model={model} setModel={setModel}
                colour={colour} setColour={setColour}
                vtype={vtype} setVtype={setVtype}
                colors={colors}
              />
            )}
            {activeTab === "Persons" && (
              <PersonsTab
                victims={victims} setVictims={setVictims}
                name={pName} setName={setPName}
                age={pAge} setAge={setPAge}
                gender={pGender} setGender={setPGender}
                condition={pCondition} setCondition={setPCondition}
                hospital={pHospital} setHospital={setPHospital}
                colors={colors}
              />
            )}
            {activeTab === "Evidence" && (
              <EvidenceTab
                evidence={evidence} setEvidence={setEvidence}
                uri={eUri} setUri={setEUri}
                label={eLabel} setLabel={setELabel}
                colors={colors}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CaseDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getIncident, updateIncident, deleteIncident } = useIncidents();
  const { user, allUsers } = useAuth();

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const incident = getIncident(id as string);

  const assignableUsers = allUsers.filter(
    (u) => u.status === "active" && u.id !== incident?.reportedBy
  );

  if (!incident) {
    return (
      <View style={[st.notFound, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[st.notFoundText, { color: colors.text }]}>Case not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={[st.notFoundBtn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // After the early-return guard above, incident is definitely defined.
  const inc = incident;

  const canEdit = user?.id === inc.reportedBy || user?.role === "supervisor" || user?.role === "commander";
  const canAssign = (user?.role === "supervisor" || user?.role === "commander") && inc.status !== "closed";
  const canTakeAction = user?.role === "supervisor" || user?.role === "commander" || inc.reportedBy === user?.id;
  const actions = STATUS_ACTIONS[inc.status];

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const sevColors: Record<string, string> = {
    fatal: colors.fatal, serious: colors.serious, minor: colors.minor, property_only: colors.property,
  };
  const sevColor = sevColors[inc.severity] || colors.mutedForeground;

  async function advanceStatus(next: IncidentStatus) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const entry = { id: Date.now().toString(), action: `Status changed to ${next.replace("_", " ")}`, by: user?.name || "", timestamp: new Date().toISOString() };
    await updateIncident(id as string, { status: next, timeline: [...inc.timeline, entry] });
  }

  async function addNote() {
    if (!noteText.trim()) return;
    const entry = { id: Date.now().toString(), action: `Note: ${noteText.trim()}`, by: user?.name || "", timestamp: new Date().toISOString() };
    await updateIncident(id as string, { timeline: [...inc.timeline, entry] });
    setNoteText(""); setAddingNote(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function assignToOfficer(officerId: string, officerName: string) {
    const entry = { id: Date.now().toString(), action: `Assigned to ${officerName}`, by: user?.name || "", timestamp: new Date().toISOString() };
    await updateIncident(id as string, { assignedTo: officerId, assignedToName: officerName, timeline: [...inc.timeline, entry] });
    setShowAssignModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleSaveEdit(updates: Partial<Incident>) {
    const entry = { id: Date.now().toString(), action: "Incident record updated", by: user?.name || "", timestamp: new Date().toISOString() };
    await updateIncident(id as string, { ...updates, timeline: [...inc.timeline, entry] });
    setShowEditModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Incident record updated.");
  }

  function confirmDelete() {
    Alert.alert("Delete incident?", "This will permanently remove this incident record and all related data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteIncident(id as string);
          router.back();
        },
      },
    ]);
  }

  async function shareCase() {
    const text = [
      "FRSC INCIDENT REPORT",
      "━━━━━━━━━━━━━━━━━━━━━",
      `Case ID: ${inc.id}`,
      `Type: ${inc.type.toUpperCase()}  |  Severity: ${inc.severity.toUpperCase()}`,
      `Status: ${inc.status.replace("_", " ").toUpperCase()}`,
      "",
      `Title: ${inc.title}`,
      `Location: ${[inc.location, inc.lga, inc.state].filter(Boolean).join(", ")}`,
      `Date/Time: ${formatDate(inc.dateTime)}`,
      `Reported by: ${inc.reportedByName}`,
      inc.assignedToName ? `Assigned to: ${inc.assignedToName}` : "Unassigned",
      inc.victims.length > 0 ? `Persons: ${inc.victims.length} (${inc.victims.map((v) => v.condition).join(", ")})` : "",
      inc.vehicles.length > 0 ? `Vehicles: ${inc.vehicles.map((v) => v.plate || "N/A").join(", ")}` : "",
      "",
      "━━━━━━━━━━━━━━━━━━━━━",
      "FRSC Field Operations App",
    ].filter(Boolean).join("\n");
    try { await Share.share({ message: text, title: `FRSC Case ${inc.id}` }); } catch { }
  }

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[st.header, { backgroundColor: colors.card, paddingTop: topPad + 12, borderBottomColor: colors.border, borderLeftColor: sevColor }]}>
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={[st.caseId, { color: colors.mutedForeground }]}>{inc.id}</Text>
            <Text style={[st.caseTitle, { color: colors.text }]} numberOfLines={2}>{inc.title}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            {inc.pendingSync && <Feather name="cloud-off" size={18} color={colors.warning} />}
            {canEdit && (
              <TouchableOpacity onPress={() => setShowEditModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="edit-2" size={19} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={shareCase} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="share-2" size={19} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={st.badgesRow}>
          <StatusBadge type="severity" value={inc.severity} />
          <StatusBadge type="status" value={inc.status} />
        </View>

        <View style={{ gap: 5 }}>
          {inc.location ? (
            <View style={st.metaItem}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[st.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{inc.location}</Text>
            </View>
          ) : null}
          <View style={st.metaItem}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[st.metaText, { color: colors.mutedForeground }]}>{formatDate(inc.dateTime)}</Text>
          </View>
        </View>

        {(inc.state || inc.lga) && (
          <View style={[st.metaItem, { marginTop: 8, flexWrap: "wrap", gap: 6 }]}>
            {inc.state ? (
              <View style={[st.chip, { backgroundColor: colors.infoLight, borderColor: colors.info + "40" }]}>
                <Feather name="flag" size={10} color={colors.info} />
                <Text style={[st.chipText, { color: colors.info, fontSize: 11 }]}>{inc.state}</Text>
              </View>
            ) : null}
            {inc.lga ? (
              <View style={[st.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="layers" size={10} color={colors.mutedForeground} />
                <Text style={[st.chipText, { color: colors.mutedForeground, fontSize: 11 }]}>{inc.lga}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

        {/* ── Status Actions ── */}
        {canTakeAction && actions.length > 0 && (
          <View style={[st.card, { marginTop: 14, borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[st.cardLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
            <View style={{ gap: 8 }}>
              {actions.map((a) => (
                <TouchableOpacity
                  key={a.next}
                  style={[st.actionBtn, { backgroundColor: a.color }]}
                  onPress={() => advanceStatus(a.next)}
                  activeOpacity={0.82}
                >
                  <Feather name={a.icon as any} size={17} color="#fff" />
                  <Text style={st.actionBtnText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Description ── */}
        {inc.description ? (
          <Section label="DESCRIPTION" colors={colors}>
            <Text style={[st.descText, { color: colors.text }]}>{inc.description}</Text>
          </Section>
        ) : null}

        {/* ── Vehicles ── */}
        <Section label={`VEHICLES${inc.vehicles.length > 0 ? ` (${inc.vehicles.length})` : ""}`} colors={colors}>
          {inc.vehicles.length === 0 ? (
            <Text style={[st.emptyInline, { color: colors.mutedForeground }]}>No vehicles recorded</Text>
          ) : (
            inc.vehicles.map((v) => (
              <View key={v.id} style={[st.subRow, { borderBottomColor: colors.border }]}>
                <View style={st.plateRow}>
                  <View style={[st.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#C8960C" }]}>
                    <Text style={st.plateText}>{v.plate || "No plate"}</Text>
                  </View>
                  <Text style={[st.vehicleTypeTxt, { color: colors.mutedForeground }]}>{v.type}</Text>
                </View>
                <Text style={[st.vehicleInfo, { color: colors.text }]}>
                  {[v.make, v.model, v.colour].filter(Boolean).join("  ·  ") || "Details pending"}
                </Text>
              </View>
            ))
          )}
          {canEdit && (
            <TouchableOpacity
              style={[st.inlineAddBtn, { borderColor: colors.primary + "30", backgroundColor: colors.primary + "10" }]}
              onPress={() => { setShowEditModal(true); }}
            >
              <Feather name="edit-3" size={13} color={colors.primary} />
              <Text style={[st.inlineAddText, { color: colors.primary }]}>Manage vehicles</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* ── Persons / Casualties ── */}
        <Section label={`PERSONS / CASUALTIES${inc.victims.length > 0 ? ` (${inc.victims.length})` : ""}`} colors={colors}>
          {inc.victims.length === 0 ? (
            <Text style={[st.emptyInline, { color: colors.mutedForeground }]}>No persons recorded</Text>
          ) : (
            inc.victims.map((v) => (
              <View key={v.id} style={[st.subRow, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={[st.victimName, { color: colors.text }]}>{v.name || "Unknown"}</Text>
                  <View style={[st.conditionPill, { backgroundColor: (CONDITION_COLORS[v.condition] ?? "#888") + "20" }]}>
                    <Text style={[st.conditionPillText, { color: CONDITION_COLORS[v.condition] ?? "#888" }]}>
                      {v.condition}
                    </Text>
                  </View>
                </View>
                <Text style={[st.victimMeta, { color: colors.mutedForeground }]}>
                  {[v.age ? `Age ${v.age}` : null, v.gender, v.hospital ? `Admitted: ${v.hospital}` : null].filter(Boolean).join("  ·  ")}
                </Text>
              </View>
            ))
          )}
          {canEdit && (
            <TouchableOpacity
              style={[st.inlineAddBtn, { borderColor: colors.primary + "30", backgroundColor: colors.primary + "10" }]}
              onPress={() => setShowEditModal(true)}
            >
              <Feather name="edit-3" size={13} color={colors.primary} />
              <Text style={[st.inlineAddText, { color: colors.primary }]}>Manage persons</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* ── Evidence ── */}
        <Section label={`EVIDENCE${inc.evidence.length > 0 ? ` (${inc.evidence.length})` : ""}`} colors={colors}>
          {inc.evidence.length === 0 ? (
            <Text style={[st.emptyInline, { color: colors.mutedForeground }]}>No evidence attached</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {inc.evidence.map((e, idx) => (
                <View key={e.id} style={st.evidenceThumb}>
                  <Image source={{ uri: e.uri }} style={st.evidenceImg} resizeMode="cover" />
                  <Text style={[st.evidenceLabel, { color: colors.mutedForeground }]}>{e.label || `#${idx + 1}`}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          {canEdit && (
            <TouchableOpacity
              style={[st.inlineAddBtn, { borderColor: colors.primary + "30", backgroundColor: colors.primary + "10", marginTop: 10 }]}
              onPress={() => setShowEditModal(true)}
            >
              <Feather name="edit-3" size={13} color={colors.primary} />
              <Text style={[st.inlineAddText, { color: colors.primary }]}>Manage evidence</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* ── Assignment ── */}
        <Section label="ASSIGNMENT" colors={colors}>
          <View style={st.assignRow}>
            <View style={{ flex: 1 }}>
              <Text style={[st.assignLabel, { color: colors.mutedForeground }]}>Reported by</Text>
              <Text style={[st.assignValue, { color: colors.text }]}>{inc.reportedByName}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.assignLabel, { color: colors.mutedForeground }]}>Assigned to</Text>
              <Text style={[st.assignValue, { color: inc.assignedToName ? colors.text : colors.mutedForeground }]}>
                {inc.assignedToName || "Unassigned"}
              </Text>
            </View>
          </View>
          {canAssign && (
            <TouchableOpacity
              style={[st.inlineAddBtn, { borderColor: colors.primary + "30", backgroundColor: colors.primary + "10", marginTop: 12 }]}
              onPress={() => setShowAssignModal(true)}
            >
              <Feather name="user-check" size={13} color={colors.primary} />
              <Text style={[st.inlineAddText, { color: colors.primary }]}>
                {inc.assignedToName ? "Reassign case" : "Assign to officer"}
              </Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* ── Danger zone ── */}
        {canEdit && (
          <Section label="RECORD MANAGEMENT" colors={colors}>
            <TouchableOpacity
              style={[st.dangerBtn, { borderColor: CONDITION_COLORS.fatal + "30", backgroundColor: CONDITION_COLORS.fatal + "0a" }]}
              onPress={confirmDelete}
              activeOpacity={0.8}
            >
              <Feather name="trash-2" size={15} color={CONDITION_COLORS.fatal} />
              <Text style={[st.dangerBtnText, { color: CONDITION_COLORS.fatal }]}>Delete this incident record</Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* ── Timeline ── */}
        <Section label="TIMELINE" colors={colors}>
          {inc.timeline.map((entry, idx) => (
            <View key={entry.id} style={st.timelineRow}>
              <View style={st.timelineLeft}>
                <View style={[st.timelineDot, { backgroundColor: colors.primary }]} />
                {idx < inc.timeline.length - 1 && (
                  <View style={[st.timelineLine, { backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={st.timelineRight}>
                <Text style={[st.timelineAction, { color: colors.text }]}>{entry.action}</Text>
                <Text style={[st.timelineMeta, { color: colors.mutedForeground }]}>{entry.by} · {formatDate(entry.timestamp)}</Text>
              </View>
            </View>
          ))}

          {!addingNote ? (
            <TouchableOpacity
              style={[st.addNoteBtn, { borderColor: colors.border }]}
              onPress={() => setAddingNote(true)}
            >
              <Feather name="plus" size={15} color={colors.primary} />
              <Text style={[st.addNoteText, { color: colors.primary }]}>Add note</Text>
            </TouchableOpacity>
          ) : (
            <View style={[st.noteBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <TextInput
                style={[st.noteInput, { color: colors.text }]}
                placeholder="Write a note…"
                placeholderTextColor={colors.mutedForeground}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                autoFocus
              />
              <View style={st.noteActions}>
                <TouchableOpacity onPress={() => { setAddingNote(false); setNoteText(""); }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.noteSubmit, { backgroundColor: colors.primary }]} onPress={addNote}>
                  <Text style={st.noteSubmitText}>Add note</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Section>
      </ScrollView>

      {/* ── Assign modal ── */}
      <Modal visible={showAssignModal} animationType="slide" transparent onRequestClose={() => setShowAssignModal(false)}>
        <View style={st.sheetOverlay}>
          <View style={[st.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHeader}>
              <Text style={[st.sheetTitle, { color: colors.text }]}>Assign Case</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[st.sheetSub, { color: colors.mutedForeground }]}>Select an active officer</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {assignableUsers.length === 0 ? (
                <Text style={[st.sheetSub, { color: colors.mutedForeground, textAlign: "center", paddingVertical: 20 }]}>No active officers available</Text>
              ) : assignableUsers.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => assignToOfficer(u.id, u.name)}
                  style={[st.officerRow, {
                    backgroundColor: inc.assignedTo === u.id ? colors.primary + "12" : "transparent",
                    borderColor: inc.assignedTo === u.id ? colors.primary + "40" : colors.border,
                  }]}
                >
                  <View style={[st.officerAvatar, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={[st.officerInitials, { color: colors.primary }]}>
                      {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.officerName, { color: colors.text }]}>{u.name}</Text>
                    <Text style={[st.officerMeta, { color: colors.mutedForeground }]}>{u.badgeNumber} · {u.station}</Text>
                  </View>
                  {inc.assignedTo === u.id && <Feather name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Full-screen edit modal ── */}
      {showEditModal && (
        <EditIncidentModal
          visible={showEditModal}
          incident={incident}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
          colors={colors}
          insets={insets}
        />
      )}
    </View>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ label, colors, children }: { label: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={[st.cardLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  notFoundText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },

  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderLeftWidth: 4 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  caseId: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2 },
  caseTitle: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 22 },
  badgesRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  section: { marginTop: 18, paddingHorizontal: 14 },
  cardLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.0, marginBottom: 8, textTransform: "uppercase" },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderRadius: 13 },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  subRow: { paddingVertical: 11, borderBottomWidth: 1 },
  plateRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  plateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  plateText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#5A3E00", letterSpacing: 0.5 },
  vehicleTypeTxt: { fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  vehicleInfo: { fontSize: 13, fontFamily: "Inter_400Regular" },

  victimName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  victimMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  conditionPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  conditionPillText: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "capitalize" },

  evidenceThumb: { width: 110, alignItems: "center" },
  evidenceImg: { width: 110, height: 86, borderRadius: 10 },
  evidenceLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },

  emptyInline: { fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 4 },

  inlineAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  inlineAddText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  assignRow: { flexDirection: "row", gap: 16 },
  assignLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 3 },
  assignValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  dangerBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 13, borderWidth: 1 },
  dangerBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  timelineRow: { flexDirection: "row", gap: 12, minHeight: 48 },
  timelineLeft: { alignItems: "center", width: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, marginTop: 4, marginBottom: -4 },
  timelineRight: { flex: 1, paddingBottom: 16 },
  timelineAction: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  timelineMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  addNoteBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", marginTop: 8 },
  addNoteText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8 },
  noteInput: { fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 70, textAlignVertical: "top" },
  noteActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8 },
  noteSubmit: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  noteSubmitText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 14 },
  officerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  officerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  officerInitials: { fontSize: 14, fontFamily: "Inter_700Bold" },
  officerName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  officerMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Edit modal
  editRoot: { flex: 1 },
  editHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  editHeaderBtn: { minWidth: 60 },
  editCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  editHeaderTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  editSaveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: "center" },
  editSaveText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 13, flexDirection: "row", justifyContent: "center", gap: 5 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  tabContent: { padding: 16, paddingBottom: 40 },

  inputLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },

  emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: 28, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", marginBottom: 16, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  recordCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  recordThumb: { width: 44, height: 44, borderRadius: 8 },
  recordTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  recordMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  pickerRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  pickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  pickerBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  previewImage: { width: 52, height: 52, borderRadius: 8 },
  previewUri: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  clearPreview: { padding: 4 },

  urlToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  urlToggleText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  deleteCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, marginLeft: 6 },

  inlineEditCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 10,
  },
  inlineEditHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  inlineEditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inlineEditTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  inlineEditActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  inlineEditCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineEditCancelText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  inlineEditSaveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  inlineEditSaveText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  addFormCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 4 },
  addFormTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 14 },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 13, borderWidth: 1 },
  addBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
