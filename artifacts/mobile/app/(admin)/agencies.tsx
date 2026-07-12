import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { ToolBackHeader } from "@/components/ToolBackHeader";
import { AgencyConfig, NewAgencyInput, useAgency } from "@/context/AgencyContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { seedCitizenReportsForAgencyMock } from "@/services/citizenIncidentApi";
import { listReports } from "@/services/reportRepository";

const COLOR_OPTIONS = ["#1B5E3B", "#1A3A6C", "#7B3F00", "#234E2A", "#344054", "#5C6BC0", "#8B1E3F", "#0F766E"];
const BUILT_IN_AGENCIES = new Set(["frsc", "police", "vio", "civil_defence", "admin"]);

type AgencyForm = Omit<NewAgencyInput, "icon">;
type AgencyTemplate = AgencyForm & {
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const EMPTY_FORM: AgencyForm = {
  name: "",
  shortName: "",
  fullName: "",
  primaryColor: COLOR_OPTIONS[0],
  secondaryColor: "#2E7D52",
  badgePrefix: "",
  description: "",
};

const AGENCY_TEMPLATES: AgencyTemplate[] = [
  {
    label: "DSS",
    name: "DSS",
    shortName: "DSS",
    fullName: "Department of State Services",
    primaryColor: "#111827",
    secondaryColor: "#374151",
    badgePrefix: "DSS",
    description: "Domestic intelligence, counter-intelligence, and national security support",
    icon: "shield",
  },
  {
    label: "Fire Service",
    name: "Fire Service",
    shortName: "FFS",
    fullName: "Federal Fire Service",
    primaryColor: "#B42318",
    secondaryColor: "#F04438",
    badgePrefix: "FFS",
    description: "Fire prevention, emergency response, rescue support, and public safety enforcement",
    icon: "alert-octagon",
  },
  {
    label: "Custom",
    ...EMPTY_FORM,
    icon: "edit-3",
  },
];

export default function AdminAgenciesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agencies, addAgency, setAgencyActive } = useAgency();
  const { allUsers, ensureAgencyDemoUsers } = useAuth();
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listReports>>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AgencyForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const autoSeededAgencyIds = useRef<Set<string>>(new Set());
  const autoSeededReportAgencyIds = useRef<Set<string>>(new Set());
  useFocusEffect(useCallback(() => { void listReports().then(setReports); }, []));

  useEffect(() => {
    const agenciesMissingUsers = agencies.filter((agency) => {
      if (agency.id === "admin") return false;
      if (autoSeededAgencyIds.current.has(agency.id)) return false;
      return !allUsers.some((user) => user.agency === agency.id);
    });

    agenciesMissingUsers.forEach((agency) => {
      autoSeededAgencyIds.current.add(agency.id);
      void ensureAgencyDemoUsers(agency);
    });
  }, [agencies, allUsers, ensureAgencyDemoUsers]);

  useEffect(() => {
    const customAgenciesMissingReports = agencies.filter((agency) => {
      if (BUILT_IN_AGENCIES.has(agency.id)) return false;
      if (agency.isActive === false) return false;
      if (autoSeededReportAgencyIds.current.has(agency.id)) return false;
      return !reports.some((report) => report.suggestedAgency === agency.id);
    });

    customAgenciesMissingReports.forEach((agency) => {
      autoSeededReportAgencyIds.current.add(agency.id);
      void seedCitizenReportsForAgencyMock(agency).then(() => listReports().then(setReports));
    });
  }, [agencies, reports]);

  const rows = useMemo(() => agencies.map((agency) => {
    const agencyReports = reports.filter((r) => r.suggestedAgency === agency.id);
    return {
      agency,
      total: agencyReports.length,
      open: agencyReports.filter((r) => r.status !== "resolved" && r.status !== "closed").length,
      resolved: agencyReports.filter((r) => r.status === "resolved" || r.status === "closed").length,
      high: agencyReports.filter((r) => r.emergencyLevel === "high" || r.emergencyLevel === "critical").length,
      activeUsers: allUsers.filter((user) => user.agency === agency.id && user.status === "active").length,
    };
  }), [agencies, allUsers, reports]);

  function set<K extends keyof AgencyForm>(key: K, value: AgencyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function applyTemplate(template: AgencyTemplate) {
    setForm({
      name: template.name,
      shortName: template.shortName,
      fullName: template.fullName,
      primaryColor: template.primaryColor,
      secondaryColor: template.secondaryColor,
      badgePrefix: template.badgePrefix,
      description: template.description,
    });
    setError("");
  }

  async function submitAgency() {
    const validation = validateAgencyForm(form);
    if (validation) {
      setError(validation);
      return;
    }

    try {
      const created = await addAgency({
        ...form,
        icon: "shield",
      });
      await ensureAgencyDemoUsers(created);
      await seedCitizenReportsForAgencyMock(created);
      setReports(await listReports());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForm(EMPTY_FORM);
      setShowAdd(false);
      setError("");
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Unable to add agency.");
    }
  }

  async function toggleAgency(agency: AgencyConfig) {
    try {
      await setAgencyActive(agency.id, agency.isActive === false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Unable to update agency status.");
    }
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}>
      <ToolBackHeader title="Admin Tools" />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Agency workload</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Manage the agency registry used by login and admin views.</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.84} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Agency</Text>
        </TouchableOpacity>
      </View>

      {error && !showAdd ? <Text style={styles.errorText}>{error}</Text> : null}

      {rows.map((row) => (
        <View key={row.agency.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <AgencyEmblem agency={row.agency.id} size={42} color={row.agency.primaryColor} label={row.agency.shortName} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleLine}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{row.agency.shortName}</Text>
                <View style={[styles.statusPill, { backgroundColor: row.agency.isActive === false ? "#FEE2E2" : "#DCFCE7" }]}>
                  <Text style={[styles.statusText, { color: row.agency.isActive === false ? "#991B1B" : "#166534" }]}>
                    {row.agency.isActive === false ? "Inactive" : "Active"}
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{row.agency.fullName}</Text>
            </View>
            <View style={[styles.registryPill, { backgroundColor: row.agency.primaryColor + "18" }]}>
              <Text style={[styles.registryText, { color: row.agency.primaryColor }]}>{row.agency.badgePrefix}</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <Stat label="Total" value={row.total} />
            <Stat label="Open" value={row.open} />
            <Stat label="Resolved" value={row.resolved} />
            <Stat label="High priority" value={row.high} />
            <Stat label="Demo users" value={row.activeUsers} />
          </View>
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: colors.border }]}
              onPress={() => router.push(`/agency-customize?agencyId=${row.agency.id}` as any)}
              activeOpacity={0.84}
            >
              <Feather name="edit-2" size={13} color={row.agency.primaryColor} />
              <Text style={[styles.editText, { color: row.agency.primaryColor }]}>Edit</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: row.agency.isActive === false ? row.agency.primaryColor : "#FEF3C7",
                  opacity: row.agency.id === "admin" ? 0.45 : 1,
                },
              ]}
              onPress={() => toggleAgency(row.agency)}
              disabled={row.agency.id === "admin"}
              activeOpacity={0.84}
            >
              <Feather name={row.agency.isActive === false ? "check-circle" : "slash"} size={14} color={row.agency.isActive === false ? "#fff" : "#92400E"} />
              <Text style={[styles.toggleText, { color: row.agency.isActive === false ? "#fff" : "#92400E" }]}>
                {row.agency.isActive === false ? "Activate" : "Deactivate"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <ScrollView style={[styles.modalRoot, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Agency</Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Create a frontend agency profile for scalable onboarding.</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Start from template</Text>
          <View style={styles.templateGrid}>
            {AGENCY_TEMPLATES.map((template) => {
              const active = form.shortName === template.shortName && template.shortName !== "";
              return (
                <TouchableOpacity
                  key={template.label}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: active ? template.primaryColor + "18" : colors.card,
                      borderColor: active ? template.primaryColor : colors.border,
                    },
                  ]}
                  onPress={() => applyTemplate(template)}
                  activeOpacity={0.84}
                >
                  <View style={[styles.templateIcon, { backgroundColor: (template.primaryColor || "#344054") + "18" }]}>
                    <Feather name={template.icon} size={17} color={template.primaryColor || "#344054"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.templateTitle, { color: colors.text }]}>{template.label}</Text>
                    <Text style={[styles.templateSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {template.fullName || "Create a blank agency profile"}
                    </Text>
                  </View>
                  {active ? <Feather name="check" size={16} color={template.primaryColor} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <Field label="Short name" value={form.shortName} onChangeText={(v) => set("shortName", v)} placeholder="e.g. FIRE" colors={colors} />
          <Field label="Display name" value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Fire Service" colors={colors} />
          <Field label="Full name" value={form.fullName} onChangeText={(v) => set("fullName", v)} placeholder="e.g. Federal Fire Service" colors={colors} />
          <Field label="Badge prefix" value={form.badgePrefix} onChangeText={(v) => set("badgePrefix", v)} placeholder="e.g. FFS" colors={colors} />
          <Field label="Mandate / description" value={form.description} onChangeText={(v) => set("description", v)} placeholder="Emergency response, fire safety..." colors={colors} multiline />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Primary color</Text>
          <View style={styles.swatches}>
            {COLOR_OPTIONS.map((color) => (
              <TouchableOpacity key={color} style={[styles.swatch, { backgroundColor: color, borderColor: form.primaryColor === color ? colors.text : "transparent" }]} onPress={() => set("primaryColor", color)}>
                {form.primaryColor === color && <Feather name="check" size={16} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity style={styles.saveBtn} onPress={submitAgency}>
            <Text style={styles.saveText}>Add Agency</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3, maxWidth: 250 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, backgroundColor: "#344054", paddingHorizontal: 12, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  registryPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  registryText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  statusPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 9, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "30.5%", backgroundColor: "#34405410", borderRadius: 12, padding: 12 },
  statValue: { color: "#344054", fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { color: "#667085", fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  cardFooter: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  footerNote: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  toggleText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  editText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 3 },
  templateGrid: { gap: 10, marginBottom: 16 },
  templateCard: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  templateIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  templateTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  templateSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17, marginTop: 2 },
  fieldWrap: { marginBottom: 14, gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_500Medium" },
  textArea: { minHeight: 86, textAlignVertical: "top" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#C0392B", fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  saveBtn: { minHeight: 50, borderRadius: 14, backgroundColor: "#344054", alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        style={[styles.input, multiline && styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
      />
    </View>
  );
}

function validateAgencyForm(form: AgencyForm) {
  if (!form.shortName.trim()) return "Short name is required.";
  if (!form.name.trim()) return "Display name is required.";
  if (!form.fullName.trim()) return "Full name is required.";
  if (!form.badgePrefix.trim()) return "Badge prefix is required.";
  if (!form.description.trim()) return "Description is required.";
  if (form.shortName.trim().length > 12) return "Short name should be 12 characters or fewer.";
  return null;
}
