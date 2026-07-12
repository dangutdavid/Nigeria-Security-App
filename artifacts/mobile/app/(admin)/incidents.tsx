import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAgency } from "@/context/AgencyContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  formatCitizenAgencyLabel,
  formatCitizenIncidentStatus,
} from "@/services/citizenIncidentApi";
import {
  appendTimelineEntry,
  listReports,
  reassignReport,
  updateReportStatus,
} from "@/services/reportRepository";

const STATUSES: Array<CitizenIncidentStatus | "all"> = ["all", "submitted", "triaged", "assigned", "in_progress", "resolved", "closed"];
const EMERGENCIES = ["all", "low", "medium", "high", "critical"] as const;
const FLOW: Record<CitizenIncidentStatus, CitizenIncidentStatus | null> = { submitted: "triaged", triaged: "assigned", assigned: "in_progress", in_progress: "resolved", resolved: "closed", closed: null };

export default function AdminIncidentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { agencies, getAgencyById } = useAgency();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  const [query, setQuery] = useState("");
  const [agency, setAgency] = useState<string | "all">("all");
  const [status, setStatus] = useState<CitizenIncidentStatus | "all">("all");
  const [emergency, setEmergency] = useState<(typeof EMERGENCIES)[number]>("all");
  const [selected, setSelected] = useState<CitizenIncidentReceipt | null>(null);
  const [note, setNote] = useState("");
  const load = useCallback(async () => setReports(await listReports()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const agencyFilters = useMemo(
    () => ["all", ...agencies.filter((item) => item.id !== "admin" && item.isActive !== false).map((item) => item.id)],
    [agencies],
  );

  function agencyLabel(id: string) {
    if (id === "all") return "All agencies";
    return getAgencyById(id)?.shortName ?? formatCitizenAgencyLabel(id);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (agency !== "all" && report.suggestedAgency !== agency) return false;
      if (status !== "all" && report.status !== status) return false;
      if (emergency !== "all" && report.emergencyLevel !== emergency) return false;
      if (!q) return true;
      return `${report.reference} ${report.location} ${report.description} ${report.vehicleRegistration ?? ""}`.toLowerCase().includes(q);
    });
  }, [reports, query, agency, status, emergency]);

  async function updateStatus(report: CitizenIncidentReceipt, next: CitizenIncidentStatus) {
    const updated = await updateReportStatus({ reference: report.reference, status: next, actorName: user?.name ?? "Admin", actorAgencyLabel: "Admin" });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
    if (updated) setSelected(updated);
  }

  async function reassign(report: CitizenIncidentReceipt, nextAgency: string) {
    const updated = await reassignReport({ reference: report.reference, agency: nextAgency, actorName: user?.name ?? "Admin" });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
    if (updated) setSelected(updated);
  }

  async function addNote() {
    if (!selected || !note.trim()) return;
    const updated = await appendTimelineEntry({ reference: selected.reference, action: `Admin note: ${note.trim()}`, actorName: user?.name ?? "Admin" });
    setNote("");
    await load();
    if (updated) setSelected(updated);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 90 }]}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}><Text style={styles.headerTitle}>All Incidents</Text><Text style={styles.headerSub}>Cross-agency citizen report management</Text></View>
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="search" size={16} color={colors.mutedForeground} /><TextInput value={query} onChangeText={setQuery} placeholder="Search reference, location, vehicle..." placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.text }]} /></View>
      <FilterRow values={agencyFilters} active={agency} setActive={setAgency} label={agencyLabel} colors={colors} />
      <FilterRow values={STATUSES} active={status} setActive={(v) => setStatus(v as CitizenIncidentStatus | "all")} label={(v) => v === "all" ? "All status" : formatCitizenIncidentStatus(v as CitizenIncidentStatus)} colors={colors} />
      <FilterRow values={[...EMERGENCIES]} active={emergency} setActive={(v) => setEmergency(v as typeof emergency)} label={(v) => v === "all" ? "Any level" : v.toUpperCase()} colors={colors} />

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map((report) => (
          <TouchableOpacity key={report.reference} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelected(report)}>
            <View style={styles.cardTop}><Text style={styles.source}>{agencyLabel(report.suggestedAgency)}</Text><Text style={styles.status}>{formatCitizenIncidentStatus(report.status)}</Text></View>
            <Text style={[styles.ref, { color: colors.text }]}>{report.reference}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{report.emergencyLevel.toUpperCase()} · {new Date(report.submittedAt).toLocaleString()}</Text>
            <Text style={[styles.desc, { color: colors.text }]} numberOfLines={2}>{report.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ScrollView style={[styles.modal, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <View style={styles.modalHeader}><TouchableOpacity onPress={() => setSelected(null)}><Feather name="x" size={22} color="#fff" /></TouchableOpacity><Text style={styles.modalTitle}>{selected.reference}</Text></View>
            <View style={[styles.detail, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>Incident detail</Text>
              <Text style={[styles.detailText, { color: colors.text }]}>{selected.description}</Text>
              <Text style={[styles.detailSub, { color: colors.mutedForeground }]}>{selected.location}</Text>
              <Text style={[styles.detailSub, { color: colors.mutedForeground }]}>Agency: {agencyLabel(selected.suggestedAgency)} · Status: {formatCitizenIncidentStatus(selected.status)}</Text>
            </View>
            <View style={[styles.detail, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>Reassign agency</Text>
              <View style={styles.wrapRow}>{agencyFilters.filter((a) => a !== "all").map((a) => <TouchableOpacity key={a} onPress={() => reassign(selected, a)} style={[styles.actionChip, { backgroundColor: selected.suggestedAgency === a ? "#344054" : colors.muted }]}><Text style={[styles.actionText, { color: selected.suggestedAgency === a ? "#fff" : colors.text }]}>{agencyLabel(a)}</Text></TouchableOpacity>)}</View>
              {FLOW[selected.status] && <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus(selected, FLOW[selected.status]!)}><Text style={styles.primaryText}>Mark {formatCitizenIncidentStatus(FLOW[selected.status]!)}</Text></TouchableOpacity>}
              <TextInput value={note} onChangeText={setNote} placeholder="Add admin note..." placeholderTextColor={colors.mutedForeground} style={[styles.noteInput, { borderColor: colors.border, color: colors.text }]} />
              <TouchableOpacity style={styles.secondaryBtn} onPress={addNote}><Text style={styles.secondaryText}>Add note</Text></TouchableOpacity>
            </View>
            <View style={[styles.detail, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>Activity</Text>
              {(selected.timeline ?? []).map((entry) => <Text key={entry.id} style={[styles.timeline, { color: colors.mutedForeground }]}>{entry.action} · {entry.by} · {new Date(entry.timestamp).toLocaleString()}</Text>)}
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

function FilterRow({ values, active, setActive, label, colors }: { values: string[]; active: string; setActive: (v: string) => void; label: (v: string) => string; colors: ReturnType<typeof useColors> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{values.map((v) => <TouchableOpacity key={v} onPress={() => setActive(v)} style={[styles.filter, { backgroundColor: active === v ? "#344054" : colors.card, borderColor: active === v ? "#344054" : colors.border }]}><Text style={[styles.filterText, { color: active === v ? "#fff" : colors.text }]}>{label(v)}</Text></TouchableOpacity>)}</ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { backgroundColor: "#344054", padding: 18 },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 13, fontFamily: "Inter_500Medium" },
  search: { margin: 16, marginBottom: 8, borderWidth: 1, borderRadius: 14, height: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  filters: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" },
  filter: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    marginRight: 8,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  list: { padding: 16, paddingTop: 6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  source: { color: "#344054", fontSize: 11, fontFamily: "Inter_700Bold" },
  status: { color: "#C8960C", fontSize: 11, fontFamily: "Inter_700Bold" },
  ref: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 8 },
  meta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 8 },
  modal: { flex: 1 },
  modalHeader: { backgroundColor: "#344054", padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  modalTitle: { color: "#fff", fontSize: 19, fontFamily: "Inter_700Bold" },
  detail: { borderWidth: 1, borderRadius: 16, padding: 16, margin: 16, marginBottom: 0, gap: 10 },
  detailTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  detailText: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  detailSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  primaryBtn: { height: 44, borderRadius: 12, backgroundColor: "#344054", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  noteInput: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: "Inter_500Medium" },
  secondaryBtn: { height: 42, borderRadius: 12, backgroundColor: "#667085", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  timeline: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
});
