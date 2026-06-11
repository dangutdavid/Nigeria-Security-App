import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
  INSPECTION_CHECKLIST,
  InspectionResult,
  ItemStatus,
  VehicleCategory,
  useInspections,
} from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#7B3F00";

const VEHICLE_CATEGORIES: VehicleCategory[] = ["private", "commercial", "government", "motorcycle", "articulated"];

const CAR_MAKES = ["Toyota", "Honda", "Hyundai", "Kia", "Ford", "Mercedes", "BMW", "Lexus", "Nissan", "Mitsubishi", "Volkswagen", "Peugeot", "Mazda", "Suzuki", "Other"];

function determineResult(items: { status: ItemStatus }[]): InspectionResult {
  const failCount = items.filter((i) => i.status === "fail").length;
  if (failCount === 0) return "pass";
  if (failCount <= 3) return "conditional";
  return "fail";
}

export default function NewInspectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { addInspection } = useInspections();

  const [step, setStep] = useState(0);
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [category, setCategory] = useState<VehicleCategory>("private");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");

  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const [defectNotes, setDefectNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function setItemStatus(key: string, status: ItemStatus) {
    setItemStatuses((prev) => ({ ...prev, [key]: status }));
  }

  function buildItems() {
    return INSPECTION_CHECKLIST.flatMap((cat, ci) =>
      cat.items.map((item, ii) => {
        const key = `${ci}-${ii}`;
        return {
          id: key,
          category: cat.category,
          item,
          status: itemStatuses[key] ?? "pass",
          note: itemNotes[key],
        };
      })
    );
  }

  async function handleSubmit() {
    if (!plate.trim()) { Alert.alert("Missing", "Please enter the plate number."); return; }
    setSaving(true);
    const items = buildItems();
    const result = determineResult(items);
    const certExpiryDate = result === "pass"
      ? new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]
      : result === "conditional"
      ? new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]
      : undefined;

    const report = await addInspection({
      plate: plate.trim().toUpperCase(),
      make, model: model.trim() || "Unknown",
      year: year.trim() || String(new Date().getFullYear()),
      color: color.trim() || "Unknown",
      vehicleCategory: category,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      engineNumber: engineNumber.trim(),
      chassisNumber: chassisNumber.trim(),
      items,
      result,
      certExpiryDate,
      defectNotes: defectNotes.trim(),
      inspectedBy: user?.id ?? "v1",
      inspectedByName: user?.name ?? "Officer",
      station: user?.station ?? "VIO Centre",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    setDone(report.id);
  }

  if (done) {
    const items = buildItems();
    const result = determineResult(items);
    const failCount = items.filter((i) => i.status === "fail").length;
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 }}>
          <View style={[styles.resultCircle, { backgroundColor: result === "pass" ? "#388E3C22" : result === "conditional" ? "#F57C0022" : "#E5393522" }]}>
            <Feather
              name={result === "pass" ? "check-circle" : result === "conditional" ? "alert-circle" : "x-circle"}
              size={60}
              color={result === "pass" ? "#388E3C" : result === "conditional" ? "#F57C00" : "#E53935"}
            />
          </View>
          <Text style={{ fontSize: 26, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" }}>
            Inspection {result === "pass" ? "Passed" : result === "conditional" ? "Conditional" : "Failed"}
          </Text>
          <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
            {result === "pass"
              ? "All checks passed. Certificate valid for 12 months."
              : result === "conditional"
              ? `${failCount} defect${failCount !== 1 ? "s" : ""} found. Conditional cert valid for 90 days — defects must be rectified.`
              : `${failCount} defect${failCount !== 1 ? "s" : ""} found. Vehicle fails roadworthiness standard.`}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: PRIMARY }]}
              onPress={() => router.push(`/inspection/${done}` as any)}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>View Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => router.push("/(vio)/inspections" as any)}
            >
              <Text style={{ color: colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>All Inspections</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const STEPS = ["Vehicle Info", "Inspection Checklist", "Summary"];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY }]}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>New Inspection</Text>
          <Text style={styles.headerStep}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.progressFill, { backgroundColor: PRIMARY, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <View style={{ gap: 14 }}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Vehicle Details</Text>

            {/* Plate */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Plate Number *</Text>
              <View style={[styles.plateRow, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
                <Text style={styles.platePrefix}>NG</Text>
                <View style={{ width: 1.5, height: "70%", backgroundColor: "#DAA520" }} />
                <TextInput value={plate} onChangeText={setPlate} placeholder="ABJ 234 KA"
                  placeholderTextColor="#B8860B"
                  style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 2 }}
                  autoCapitalize="characters" autoCorrect={false}
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Vehicle Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {VEHICLE_CATEGORIES.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setCategory(c)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: category === c ? PRIMARY : colors.muted, borderWidth: 1, borderColor: category === c ? PRIMARY : colors.border }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: category === c ? "#fff" : colors.text }}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Make */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Make</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CAR_MAKES.map((m) => (
                    <TouchableOpacity key={m} onPress={() => setMake(m)}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: make === m ? PRIMARY : colors.muted, borderWidth: 1, borderColor: make === m ? PRIMARY : colors.border }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: make === m ? "#fff" : colors.text }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {[
              { label: "Model", value: model, set: setModel, placeholder: "e.g. Camry" },
              { label: "Year", value: year, set: setYear, placeholder: "e.g. 2021", keyboardType: "numeric" as const },
              { label: "Colour", value: color, set: setColor, placeholder: "e.g. Silver" },
              { label: "Owner Name", value: ownerName, set: setOwnerName, placeholder: "Full name" },
              { label: "Owner Phone", value: ownerPhone, set: setOwnerPhone, placeholder: "08012345678", keyboardType: "phone-pad" as const },
              { label: "Engine Number", value: engineNumber, set: setEngineNumber, placeholder: "From chassis plate" },
              { label: "Chassis Number (VIN)", value: chassisNumber, set: setChassisNumber, placeholder: "17-character VIN" },
            ].map((f) => (
              <View key={f.label} style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.set} placeholder={f.placeholder}
                  placeholderTextColor={colors.mutedForeground} keyboardType={f.keyboardType}
                  style={[styles.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
                />
              </View>
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: 20 }}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Inspection Checklist</Text>
            <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>
              Tap each item to mark as Pass / Fail / N/A
            </Text>
            {INSPECTION_CHECKLIST.map((cat, ci) => (
              <View key={cat.category} style={{ gap: 8 }}>
                <Text style={[styles.catTitle, { color: colors.text, borderBottomColor: colors.border }]}>{cat.category}</Text>
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  const status = itemStatuses[key] ?? "pass";
                  return (
                    <View key={key} style={[styles.checkItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.checkItemText, { color: colors.text, flex: 1 }]}>{item}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {(["pass", "fail", "na"] as ItemStatus[]).map((s) => (
                          <TouchableOpacity key={s} onPress={() => setItemStatus(key, s)}
                            style={[styles.statusBtn, { backgroundColor: status === s ? (s === "pass" ? "#388E3C" : s === "fail" ? "#E53935" : "#757575") : colors.muted, borderColor: status === s ? "transparent" : colors.border }]}>
                            <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: status === s ? "#fff" : colors.mutedForeground }}>
                              {s === "na" ? "N/A" : s.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 16 }}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Summary & Submit</Text>
            {(() => {
              const items = buildItems();
              const result = determineResult(items);
              const failCount = items.filter((i) => i.status === "fail").length;
              const passCount = items.filter((i) => i.status === "pass").length;
              return (
                <>
                  <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }]}>Vehicle</Text>
                    <Text style={[{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.text }]}>{plate.toUpperCase()} · {year} {color} {make} {model}</Text>
                    <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>{ownerName || "Owner not specified"}</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: result === "pass" ? "#E8F5E9" : result === "conditional" ? "#FFF8E1" : "#FFEBEE", borderColor: result === "pass" ? "#C8E6C9" : result === "conditional" ? "#FFECB3" : "#FFCDD2" }]}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: result === "pass" ? "#1B5E20" : result === "conditional" ? "#E65100" : "#B71C1C" }}>
                      Preliminary Result: {result.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: result === "pass" ? "#2E7D32" : result === "conditional" ? "#BF360C" : "#C62828" }}>
                      {passCount} passed · {failCount} failed
                    </Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.text }]}>Defect / Inspection Notes</Text>
                    <TextInput
                      value={defectNotes} onChangeText={setDefectNotes}
                      placeholder="Describe any defects or observations..."
                      placeholderTextColor={colors.mutedForeground} multiline numberOfLines={4}
                      style={[styles.input, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border, minHeight: 90, textAlignVertical: "top" }]}
                    />
                  </View>
                </>
              );
            })()}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: PRIMARY }]} onPress={() => setStep(step + 1)} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: PRIMARY, opacity: saving ? 0.7 : 1 }]} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>{saving ? "Saving..." : "Submit Inspection"}</Text>
            <Feather name="check" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  headerStep: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  content: { padding: 16 },
  stepTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  plateRow: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 12, overflow: "hidden" },
  platePrefix: { paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_700Bold", color: "#8B6914" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  catTitle: { fontSize: 14, fontFamily: "Inter_700Bold", paddingBottom: 6, borderBottomWidth: 1 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  checkItemText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  footer: { borderTopWidth: 1, padding: 16 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  resultCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  doneBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 14 },
});
