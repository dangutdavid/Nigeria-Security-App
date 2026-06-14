import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  appendCitizenIncidentTimelineMock,
  formatCitizenAgencyLabel,
  formatCitizenIncidentStatus,
  listNscdcCitizenIncidentReports,
  updateCitizenIncidentStatusMock,
} from "@/services/citizenIncidentApi";

const STATUS_FLOW: Record<CitizenIncidentStatus, CitizenIncidentStatus | null> = {
  submitted: "triaged",
  triaged: "assigned",
  assigned: "in_progress",
  in_progress: "resolved",
  resolved: "closed",
  closed: null,
};

type StatusFilter = "all" | CitizenIncidentStatus;
type EmergencyFilter = "all" | "low" | "medium" | "high" | "critical";

export default function CivilDefenceIncidentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [emergency, setEmergency] = useState<EmergencyFilter>("all");
  const [selected, setSelected] = useState<CitizenIncidentReceipt | null>(null);
  const [note, setNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setReports(await listNscdcCitizenIncidentReports()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (status !== "all" && report.status !== status) return false;
      if (emergency !== "all" && report.emergencyLevel !== emergency) return false;
      if (!q) return true;
      return `${report.reference} ${report.location} ${report.description} ${report.vehicleRegistration ?? ""} ${report.incidentType}`.toLowerCase().includes(q);
    });
  }, [reports, query, status, emergency]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function advance(report: CitizenIncidentReceipt) {
    const next = STATUS_FLOW[report.status];
    if (!next) return;
    const updated = await updateCitizenIncidentStatusMock({
      reference: report.reference,
      status: next,
      actorName: user?.name ?? "NSCDC",
      actorAgencyLabel: "NSCDC",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
    if (updated) setSelected(updated);
  }

  async function submitNote() {
    if (!selected || !note.trim()) return;
    const updated = await appendCitizenIncidentTimelineMock({
      reference: selected.reference,
      action: `NSCDC note: ${note.trim()}`,
      actorName: user?.name ?? "NSCDC",
    });
    setNote("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
    if (updated) setSelected(updated);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 90 }]}>
      <View style={[styles.header, { backgroundColor: "#234E2A" }]}>
        <Text style={styles.headerTitle}>NSCDC Incidents</Text>
        <Text style={styles.headerSub}>Citizen reports and civil protection cases</Text>
      </View>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search reference, location, vehicle..." placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.text }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(["all", "submitted", "triaged", "assigned", "in_progress", "resolved", "closed"] as StatusFilter[]).map((item) => (
          <TouchableOpacity key={item} onPress={() => setStatus(item)} style={[styles.filterChip, { backgroundColor: status === item ? "#234E2A" : colors.card, borderColor: status === item ? "#234E2A" : colors.border }]}>
            <Text style={[styles.filterText, { color: status === item ? "#fff" : colors.text }]}>{item === "all" ? "All" : formatCitizenIncidentStatus(item)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(["all", "low", "medium", "high", "critical"] as EmergencyFilter[]).map((item) => (
          <TouchableOpacity key={item} onPress={() => setEmergency(item)} style={[styles.filterChip, { backgroundColor: emergency === item ? "#C8960C" : colors.card, borderColor: emergency === item ? "#C8960C" : colors.border }]}>
            <Text style={[styles.filterText, { color: emergency === item ? "#fff" : colors.text }]}>{item === "all" ? "Any level" : item.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#234E2A" />}>
        {filtered.map((report) => (
          <TouchableOpacity key={report.reference} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelected(report)} activeOpacity={0.86}>
            <View style={styles.cardTop}>
              <View style={styles.sourcePill}><Text style={styles.sourceText}>Citizen Report</Text></View>
              <Text style={[styles.statusText, { color: statusColor(report.status) }]}>{formatCitizenIncidentStatus(report.status)}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{report.reference}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{report.incidentType.replaceAll("_", " ")} · {report.emergencyLevel.toUpperCase()} · {new Date(report.submittedAt).toLocaleString()}</Text>
            <Text style={[styles.desc, { color: colors.text }]} numberOfLines={2}>{report.description}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>Routed agency: {formatCitizenAgencyLabel(report.suggestedAgency)}</Text>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>No NSCDC reports found.</Text>}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ScrollView style={[styles.modal, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <View style={[styles.modalHeader, { backgroundColor: "#234E2A" }]}>
              <TouchableOpacity onPress={() => setSelected(null)}><Feather name="x" size={22} color="#fff" /></TouchableOpacity>
              <Text style={styles.modalTitle}>{selected.reference}</Text>
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Detail label="Status" value={formatCitizenIncidentStatus(selected.status)} />
              <Detail label="Emergency" value={selected.emergencyLevel.toUpperCase()} />
              <Detail label="Location" value={selected.location} />
              <Detail label="Vehicle registration" value={selected.vehicleRegistration ?? "Not provided"} />
              <Detail label="Submitted" value={new Date(selected.submittedAt).toLocaleString()} />
              <Detail label="Description" value={selected.description} />
              {selected.photoUri ? <Image source={{ uri: selected.photoUri }} style={styles.photo} /> : <Text style={[styles.placeholder, { color: colors.mutedForeground }]}>No attached photo</Text>}
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Timeline</Text>
              {(selected.timeline ?? []).map((entry) => (
                <View key={entry.id} style={styles.timelineRow}>
                  <Text style={[styles.timelineAction, { color: colors.text }]}>{entry.action}</Text>
                  <Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>{entry.by} · {new Date(entry.timestamp).toLocaleString()}</Text>
                </View>
              ))}
              <TextInput value={note} onChangeText={setNote} placeholder="Add NSCDC note..." placeholderTextColor={colors.mutedForeground} style={[styles.noteInput, { borderColor: colors.border, color: colors.text }]} />
              <TouchableOpacity style={styles.noteBtn} onPress={submitNote}><Text style={styles.noteBtnText}>Add note</Text></TouchableOpacity>
            </View>
            {STATUS_FLOW[selected.status] && (
              <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(selected)}>
                <Text style={styles.advanceText}>Mark {formatCitizenIncidentStatus(STATUS_FLOW[selected.status]!)}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function statusColor(status: CitizenIncidentStatus) {
  if (status === "submitted") return "#C8960C";
  if (status === "triaged") return "#234E2A";
  if (status === "assigned") return "#2C7BE5";
  if (status === "in_progress") return "#7C3AED";
  return "#27AE60";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { padding: 18, paddingTop: 22 },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  searchWrap: { margin: 16, marginBottom: 8, borderWidth: 1, borderRadius: 14, height: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  filterText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  list: { padding: 16, paddingTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sourcePill: { backgroundColor: "#234E2A18", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  sourceText: { color: "#234E2A", fontSize: 11, fontFamily: "Inter_700Bold" },
  statusText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 10 },
  meta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4, textTransform: "capitalize" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 8 },
  empty: { textAlign: "center", marginTop: 40, fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1 },
  modalHeader: { padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  modalTitle: { color: "#fff", fontSize: 19, fontFamily: "Inter_700Bold" },
  detailCard: { margin: 16, marginBottom: 0, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  detailRow: { gap: 4 },
  detailLabel: { color: "#6B7280", fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  detailValue: { color: "#111827", fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  photo: { height: 190, borderRadius: 14 },
  placeholder: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  timelineRow: { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)", paddingTop: 10 },
  timelineAction: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  timelineMeta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  noteInput: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: "Inter_500Medium" },
  noteBtn: { height: 42, borderRadius: 12, backgroundColor: "#234E2A", alignItems: "center", justifyContent: "center" },
  noteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  advanceBtn: { margin: 16, height: 50, borderRadius: 14, backgroundColor: "#234E2A", alignItems: "center", justifyContent: "center" },
  advanceText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
