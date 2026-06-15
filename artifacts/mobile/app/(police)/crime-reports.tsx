import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
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
  CrimeReport,
  CrimeStatus,
  CrimeType,
  CRIME_TYPE_LABELS,
  useCrimeReports,
} from "@/context/CrimeReportContext";
import { useColors } from "@/hooks/useColors";
import {
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  formatCitizenIncidentStatus,
} from "@/services/citizenIncidentApi";
import { listReportsByAgency, updateReportStatus } from "@/services/reportRepository";
import { useAgencyBrand } from "@/context/AgencyContext";

const FALLBACK_PRIMARY = "#1A3A6C";

const STATUS_TABS: { id: CrimeStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "investigating", label: "Active" },
  { id: "arrested", label: "Arrested" },
  { id: "closed", label: "Closed" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "#E53935",
  investigating: "#F57C00",
  arrested: "#388E3C",
  closed: "#9E9E9E",
};

const SEV_COLORS: Record<string, string> = {
  minor: "#9E9E9E",
  moderate: "#F57C00",
  serious: "#E53935",
  critical: "#880E4F",
};

const CRIME_TYPES: CrimeType[] = ["vehicle_theft", "robbery", "assault", "drug_trafficking", "fraud", "kidnapping", "arson", "cybercrime", "other"];
const SEVERITIES = ["minor", "moderate", "serious", "critical"] as const;

const CITIZEN_STATUS_FLOW: Record<CitizenIncidentStatus, CitizenIncidentStatus | null> = {
  submitted: "triaged",
  triaged: "assigned",
  assigned: "in_progress",
  in_progress: "resolved",
  resolved: "closed",
  closed: null,
};

const CITIZEN_STATUS_COLORS: Record<CitizenIncidentStatus, string> = {
  submitted: "#E53935",
  triaged: "#F57C00",
  assigned: FALLBACK_PRIMARY,
  in_progress: "#1565C0",
  resolved: "#388E3C",
  closed: "#9E9E9E",
};

const CITIZEN_STATUS_TO_TAB: Record<CitizenIncidentStatus, CrimeStatus> = {
  submitted: "open",
  triaged: "investigating",
  assigned: "investigating",
  in_progress: "investigating",
  resolved: "closed",
  closed: "closed",
};

function formatIncidentType(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NewReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { primary: PRIMARY } = useAgencyBrand("police", { primary: FALLBACK_PRIMARY });
  const { user } = useAuth();
  const { addReport } = useCrimeReports();
  const [crimeType, setCrimeType] = useState<CrimeType>("robbery");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "serious" | "critical">("moderate");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !location.trim()) return;
    setLoading(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addReport({
      crimeType,
      severity,
      status: "open",
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      state: state.trim() || "FCT",
      lga: lga.trim() || "Abuja Municipal",
      plate: plate.trim() || undefined,
      suspects: [],
      evidence: [],
      reportedBy: user?.id ?? "p1",
      reportedByName: user?.name ?? "Officer",
      notes: "",
    });
    setLoading(false);
    setTitle(""); setDescription(""); setLocation(""); setState(""); setLga(""); setPlate("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[{ flex: 1, backgroundColor: colors.background }]}>
        <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text }}>New Crime Report</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.text} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.text }}>Crime Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CRIME_TYPES.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setCrimeType(t)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: crimeType === t ? PRIMARY : colors.muted, borderWidth: 1, borderColor: crimeType === t ? PRIMARY : colors.border }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: crimeType === t ? "#fff" : colors.text }}>{CRIME_TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.text }}>Severity</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {SEVERITIES.map((s) => (
                <TouchableOpacity key={s} onPress={() => setSeverity(s)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: severity === s ? SEV_COLORS[s] : colors.muted, borderWidth: 1, borderColor: severity === s ? SEV_COLORS[s] : colors.border }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: severity === s ? "#fff" : colors.mutedForeground }}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {[
            { label: "Title / Incident Summary *", value: title, set: setTitle, placeholder: "e.g. Armed robbery at Wuse Market" },
            { label: "Location *", value: location, set: setLocation, placeholder: "Street / area" },
            { label: "State", value: state, set: setState, placeholder: "e.g. FCT" },
            { label: "LGA", value: lga, set: setLga, placeholder: "e.g. Abuja Municipal" },
            { label: "Vehicle Plate (if relevant)", value: plate, set: setPlate, placeholder: "e.g. ABJ 234 KA" },
          ].map((f) => (
            <View key={f.label} style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.text }}>{f.label}</Text>
              <TextInput
                value={f.value} onChangeText={f.set} placeholder={f.placeholder}
                placeholderTextColor={colors.mutedForeground}
                style={{ borderWidth: 1, borderRadius: 12, borderColor: colors.border, backgroundColor: colors.muted, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text }}
              />
            </View>
          ))}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.text }}>Description</Text>
            <TextInput
              value={description} onChangeText={setDescription} placeholder="Full account of the incident..."
              placeholderTextColor={colors.mutedForeground} multiline numberOfLines={4}
              style={{ borderWidth: 1, borderRadius: 12, borderColor: colors.border, backgroundColor: colors.muted, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text, minHeight: 90, textAlignVertical: "top" }}
            />
          </View>
          <TouchableOpacity
            style={{ backgroundColor: !title.trim() || !location.trim() || loading ? colors.muted : PRIMARY, borderRadius: 14, paddingVertical: 15, alignItems: "center" }}
            onPress={handleSubmit} disabled={!title.trim() || !location.trim() || loading}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: !title.trim() || !location.trim() ? colors.mutedForeground : "#fff" }}>Submit Report</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CrimeReportsScreen() {
  const colors = useColors();
  const { primary: PRIMARY } = useAgencyBrand("police", { primary: FALLBACK_PRIMARY });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { reports } = useCrimeReports();
  const [citizenReports, setCitizenReports] = useState<CitizenIncidentReceipt[]>([]);
  const [statusFilter, setStatusFilter] = useState<CrimeStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const loadCitizenReports = useCallback(async () => {
    setCitizenReports(await listReportsByAgency("police"));
  }, []);

  useFocusEffect(useCallback(() => { void loadCitizenReports(); }, [loadCitizenReports]));

  const filtered = useMemo(() => {
    let r = reports;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.title.toLowerCase().includes(q) || x.location.toLowerCase().includes(q) || (x.plate ?? "").toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [reports, statusFilter, search]);

  const filteredCitizenReports = useMemo(() => {
    let r = citizenReports;
    if (statusFilter !== "all") r = r.filter((x) => CITIZEN_STATUS_TO_TAB[x.status] === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        x.reference.toLowerCase().includes(q) ||
        x.location.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q) ||
        (x.vehicleRegistration ?? "").toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [citizenReports, statusFilter, search]);

  async function advanceCitizenReport(report: CitizenIncidentReceipt) {
    const next = CITIZEN_STATUS_FLOW[report.status];
    if (!next) return;
    await updateReportStatus({
      reference: report.reference,
      status: next,
      actorName: user?.name ?? "Police",
      actorAgencyLabel: "Police",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadCitizenReports();
  }

  function renderCitizenReport(report: CitizenIncidentReceipt) {
    const next = CITIZEN_STATUS_FLOW[report.status];
    return (
      <View key={report.reference} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.sevBar, { backgroundColor: CITIZEN_STATUS_COLORS[report.status] }]} />
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{report.reference}</Text>
            <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>{timeAgo(report.submittedAt)}</Text>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{formatIncidentType(report.incidentType)} · {report.location}</Text>
          <Text style={[styles.cardMeta, { color: colors.text }]} numberOfLines={2}>{report.description}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <View style={[styles.sourceBadge, { backgroundColor: PRIMARY + "18" }]}>
              <Text style={[styles.badgeText, { color: PRIMARY }]}>Citizen Report</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: CITIZEN_STATUS_COLORS[report.status] + "22" }]}>
              <Text style={[styles.badgeText, { color: CITIZEN_STATUS_COLORS[report.status] }]}>{formatCitizenIncidentStatus(report.status)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{report.emergencyLevel.toUpperCase()}</Text>
            </View>
            {report.vehicleRegistration && (
              <View style={[styles.badge, { backgroundColor: "#FFF8DC" }]}>
                <Text style={[styles.badgeText, { color: "#5C3D00" }]}>{report.vehicleRegistration}</Text>
              </View>
            )}
          </View>
          {next && (
            <TouchableOpacity style={[styles.advanceBtn, { borderColor: PRIMARY, backgroundColor: PRIMARY + "12" }]} onPress={() => advanceCitizenReport(report)}>
              <Feather name="arrow-right-circle" size={14} color={PRIMARY} />
              <Text style={[styles.advanceText, { color: PRIMARY }]}>Mark {formatCitizenIncidentStatus(next)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  function renderItem({ item: r }: { item: CrimeReport }) {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/crime/${r.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={[styles.sevBar, { backgroundColor: SEV_COLORS[r.severity] ?? "#9E9E9E" }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
            <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>{timeAgo(r.reportedAt)}</Text>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{CRIME_TYPE_LABELS[r.crimeType as CrimeType]} · {r.location}</Text>
          <Text style={[styles.caseNum, { color: PRIMARY }]}>{r.caseNumber}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[r.status] + "22" }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLORS[r.status] }]}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Text>
            </View>
            {r.suspects.length > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{r.suspects.length} suspect{r.suspects.length !== 1 ? "s" : ""}</Text>
              </View>
            )}
            {r.plate && (
              <View style={[styles.badge, { backgroundColor: PRIMARY + "18" }]}>
                <Text style={[styles.badgeText, { color: PRIMARY }]}>{r.plate}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY, borderBottomColor: "transparent" }]}>
        <Text style={styles.headerTitle}>Crime Reports</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search} onChangeText={setSearch} placeholder="Search reports, plates..."
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text }}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>

      {/* Status Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabsScroll, { borderBottomColor: colors.border }]} contentContainerStyle={styles.tabs}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setStatusFilter(t.id)}
            style={[styles.tab, statusFilter === t.id && { borderBottomWidth: 2, borderBottomColor: PRIMARY }]}>
            <Text style={[styles.tabText, { color: statusFilter === t.id ? PRIMARY : colors.mutedForeground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          filteredCitizenReports.length > 0 ? (
            <View style={{ gap: 10, marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Citizen Reports</Text>
              {filteredCitizenReports.map(renderCitizenReport)}
              {filtered.length > 0 && <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 6 }]}>Police Case Files</Text>}
            </View>
          ) : null
        }
        ListEmptyComponent={
          filteredCitizenReports.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="file-text" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No crime reports found</Text>
            </View>
          ) : null
        }
      />

      <NewReportModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  tabsScroll: { borderBottomWidth: 1, flexGrow: 0 },
  tabs: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { padding: 14, gap: 10 },
  card: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, overflow: "hidden" },
  sevBar: { width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  caseNum: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sourceBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  advanceBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4 },
  advanceText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
