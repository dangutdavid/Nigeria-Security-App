import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { InspectionReport, InspectionResult, useInspections } from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";
import {
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  formatCitizenIncidentStatus,
} from "@/services/citizenIncidentApi";
import { listReportsByAgency, updateReportStatus } from "@/services/reportRepository";

const PRIMARY = "#7B3F00";

const RESULT_COLORS: Record<InspectionResult, string> = {
  pass: "#388E3C",
  fail: "#E53935",
  conditional: "#F57C00",
};

const FILTER_TABS: { id: InspectionResult | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pass", label: "Passed" },
  { id: "fail", label: "Failed" },
  { id: "conditional", label: "Conditional" },
];

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
  assigned: PRIMARY,
  in_progress: "#1565C0",
  resolved: "#388E3C",
  closed: "#9E9E9E",
};

function formatIncidentType(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InspectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { inspections } = useInspections();
  const [citizenReports, setCitizenReports] = useState<CitizenIncidentReceipt[]>([]);
  const [filter, setFilter] = useState<InspectionResult | "all">("all");
  const [search, setSearch] = useState("");

  const loadCitizenReports = useCallback(async () => {
    setCitizenReports(await listReportsByAgency("vio"));
  }, []);

  useFocusEffect(useCallback(() => { void loadCitizenReports(); }, [loadCitizenReports]));

  const filtered = useMemo(() => {
    let r = inspections;
    if (filter !== "all") r = r.filter((i) => i.result === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((i) =>
        i.plate.toLowerCase().includes(q) ||
        i.make.toLowerCase().includes(q) ||
        i.ownerName.toLowerCase().includes(q) ||
        i.certNumber.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime());
  }, [inspections, filter, search]);

  const filteredCitizenReports = useMemo(() => {
    let r = citizenReports;
    if (filter === "pass") r = r.filter((x) => x.status === "resolved" || x.status === "closed");
    if (filter === "conditional") r = r.filter((x) => x.status === "triaged" || x.status === "assigned");
    if (filter === "fail") r = r.filter((x) => x.status === "submitted" || x.status === "in_progress");
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
  }, [citizenReports, filter, search]);

  async function advanceCitizenReport(report: CitizenIncidentReceipt) {
    const next = CITIZEN_STATUS_FLOW[report.status];
    if (!next) return;
    await updateReportStatus({
      reference: report.reference,
      status: next,
      actorName: user?.name ?? "VIO",
      actorAgencyLabel: "VIO",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadCitizenReports();
  }

  function renderCitizenReport(report: CitizenIncidentReceipt) {
    const next = CITIZEN_STATUS_FLOW[report.status];
    return (
      <View key={report.reference} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.resultBar, { backgroundColor: CITIZEN_STATUS_COLORS[report.status] }]} />
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
              <Text style={styles.plateText}>{report.vehicleRegistration ?? report.reference}</Text>
            </View>
            <View style={[styles.resultChip, { backgroundColor: PRIMARY + "18" }]}>
              <Text style={[styles.resultChipText, { color: PRIMARY }]}>Citizen Report</Text>
            </View>
            <Text style={[styles.cardTime, { color: colors.mutedForeground, marginLeft: "auto" }]}>{timeAgo(report.submittedAt)}</Text>
          </View>
          <Text style={[styles.vehicleDesc, { color: colors.text }]}>{formatIncidentType(report.incidentType)} · {report.location}</Text>
          <Text style={[styles.ownerText, { color: colors.mutedForeground }]} numberOfLines={2}>{report.description}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Text style={[styles.certNum, { color: PRIMARY }]}>{report.reference}</Text>
            <Text style={[styles.failCount, { color: CITIZEN_STATUS_COLORS[report.status] }]}>{formatCitizenIncidentStatus(report.status)}</Text>
            <Text style={[styles.failCount, { color: colors.mutedForeground }]}>{report.emergencyLevel.toUpperCase()}</Text>
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

  function renderItem({ item: r }: { item: InspectionReport }) {
    const failCount = r.items.filter((i) => i.status === "fail").length;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/inspection/${r.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={[styles.resultBar, { backgroundColor: RESULT_COLORS[r.result] }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
              <Text style={styles.plateText}>{r.plate}</Text>
            </View>
            <View style={[styles.resultChip, { backgroundColor: RESULT_COLORS[r.result] + "22" }]}>
              <Text style={[styles.resultChipText, { color: RESULT_COLORS[r.result] }]}>
                {r.result.charAt(0).toUpperCase() + r.result.slice(1)}
              </Text>
            </View>
            <Text style={[styles.cardTime, { color: colors.mutedForeground, marginLeft: "auto" }]}>{timeAgo(r.inspectedAt)}</Text>
          </View>
          <Text style={[styles.vehicleDesc, { color: colors.text }]}>{r.year} {r.color} {r.make} {r.model}</Text>
          <Text style={[styles.ownerText, { color: colors.mutedForeground }]}>{r.ownerName} · {r.vehicleCategory}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={[styles.certNum, { color: PRIMARY }]}>{r.certNumber}</Text>
            {failCount > 0 && (
              <Text style={[styles.failCount, { color: "#E53935" }]}>{failCount} defect{failCount !== 1 ? "s" : ""}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY }]}>
        <Text style={styles.headerTitle}>Inspections</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(vio)/new-inspection" as any)}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search} onChangeText={setSearch} placeholder="Search plate, owner, cert number..."
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text }}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabsScroll, { borderBottomColor: colors.border }]} contentContainerStyle={styles.tabs}>
        {FILTER_TABS.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setFilter(t.id)}
            style={[styles.tab, filter === t.id && { borderBottomWidth: 2, borderBottomColor: PRIMARY }]}>
            <Text style={[styles.tabText, { color: filter === t.id ? PRIMARY : colors.mutedForeground }]}>{t.label}</Text>
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Citizen Vehicle Reports</Text>
              {filteredCitizenReports.map(renderCitizenReport)}
              {filtered.length > 0 && <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 6 }]}>Inspection Records</Text>}
            </View>
          ) : null
        }
        ListEmptyComponent={
          filteredCitizenReports.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clipboard" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No inspections found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  tabsScroll: { borderBottomWidth: 1, flexGrow: 0 },
  tabs: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { padding: 14, gap: 10 },
  card: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, overflow: "hidden" },
  resultBar: { width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0 },
  plateBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 1 },
  resultChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  resultChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  vehicleDesc: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ownerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  certNum: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  failCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  advanceBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4 },
  advanceText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
