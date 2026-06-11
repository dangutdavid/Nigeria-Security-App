import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { ReferModal } from "@/components/ReferModal";
import { useAuth } from "@/context/AuthContext";
import { CrimeStatus, CRIME_TYPE_LABELS, CrimeType, useCrimeReports } from "@/context/CrimeReportContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";

const PRIMARY = "#1A3A6C";

const STATUS_COLORS: Record<CrimeStatus, string> = {
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

const STATUS_TRANSITIONS: Record<CrimeStatus, CrimeStatus[]> = {
  open: ["investigating", "closed"],
  investigating: ["arrested", "closed"],
  arrested: ["closed"],
  closed: [],
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CrimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { getReport, updateReport } = useCrimeReports();
  const { can } = usePermissions();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const canRefer = can("refer", "crime_report");

  const report = getReport(id ?? "");

  if (!report) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 16, fontFamily: "Inter_400Regular" }}>Report not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: PRIMARY, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function changeStatus(newStatus: CrimeStatus) {
    if (!report) return;
    setSaving(true);
    await updateReport(report.id, {
      status: newStatus,
      ...(newStatus === "closed" ? { closedAt: new Date().toISOString() } : {}),
    });
    setSaving(false);
  }

  async function addNote() {
    if (!report || !note.trim()) return;
    const updated = report.notes ? `${report.notes}\n[${new Date().toLocaleString()}] ${user?.name}: ${note.trim()}` : `[${new Date().toLocaleString()}] ${user?.name}: ${note.trim()}`;
    await updateReport(report.id, { notes: updated });
    setNote("");
  }

  const nextStatuses = report ? STATUS_TRANSITIONS[report.status] : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: PRIMARY }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{report.title}</Text>
          <Text style={styles.headerCase}>{report.caseNumber}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[report.status] + "33" }]}>
          <Text style={[styles.statusChipText, { color: "#fff" }]}>{report.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Severity + type */}
        <View style={[styles.metaRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.metaItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Crime Type</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{CRIME_TYPE_LABELS[report.crimeType as CrimeType]}</Text>
          </View>
          <View style={[styles.metaItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Severity</Text>
            <Text style={[styles.metaValue, { color: SEV_COLORS[report.severity] }]}>{report.severity.toUpperCase()}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Reported</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{timeAgo(report.reportedAt)}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Incident Details</Text>
          <View style={{ gap: 8 }}>
            {[
              { label: "Location", value: `${report.location}, ${report.lga}, ${report.state}` },
              ...(report.plate ? [{ label: "Vehicle Plate", value: report.plate }] : []),
              ...(report.vehicleDescription ? [{ label: "Vehicle", value: report.vehicleDescription }] : []),
              { label: "Reported By", value: report.reportedByName },
              ...(report.assignedToName ? [{ label: "Assigned To", value: report.assignedToName }] : []),
            ].map((f) => (
              <View key={f.label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{f.value}</Text>
              </View>
            ))}
          </View>
          {report.description ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground, marginBottom: 4 }]}>Description</Text>
              <Text style={[{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text, lineHeight: 20 }]}>{report.description}</Text>
            </View>
          ) : null}
        </View>

        {/* Suspects */}
        {report.suspects.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Suspects ({report.suspects.length})</Text>
            {report.suspects.map((s) => (
              <View key={s.id} style={[styles.suspectRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <View style={[styles.suspectStatus, { backgroundColor: s.status === "arrested" ? "#388E3C22" : s.status === "released" ? "#9E9E9E22" : "#E5393522" }]}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: s.status === "arrested" ? "#388E3C" : s.status === "released" ? "#9E9E9E" : "#E53935" }}>
                    {s.status === "at_large" ? "AT LARGE" : s.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.text, flex: 1 }}>{s.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Status Update */}
        {nextStatuses.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Update Status</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {nextStatuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn, { backgroundColor: STATUS_COLORS[s] + "22", borderColor: STATUS_COLORS[s] + "44", opacity: saving ? 0.6 : 1 }]}
                  onPress={() => {
                    Alert.alert(`Mark as ${s}?`, `Change report status to "${s}"?`, [
                      { text: "Cancel" },
                      { text: "Confirm", onPress: () => changeStatus(s) },
                    ]);
                  }}
                  disabled={saving}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: STATUS_COLORS[s] }}>
                    → {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Cross-agency referral */}
        {canRefer && (
          <TouchableOpacity
            style={[styles.referBtn, { backgroundColor: colors.card, borderColor: PRIMARY + "55" }]}
            onPress={() => setShowRefer(true)}
          >
            <View style={[styles.referIcon, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="git-pull-request" size={18} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.referTitle, { color: colors.text }]}>Refer to another agency</Text>
              <Text style={[styles.referSub, { color: colors.mutedForeground }]}>Share this case with another agency</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Notes */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Case Notes</Text>
          {report.notes ? (
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.text, lineHeight: 20, marginBottom: 12 }}>{report.notes}</Text>
          ) : (
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 12 }}>No notes yet.</Text>
          )}
          <View style={{ gap: 8 }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.noteInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.text }]}
            />
            <TouchableOpacity
              style={[styles.addNoteBtn, { backgroundColor: note.trim() ? PRIMARY : colors.muted }]}
              onPress={addNote}
              disabled={!note.trim()}
            >
              <Text style={{ color: note.trim() ? "#fff" : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Add Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ReferModal
        visible={showRefer}
        onClose={() => setShowRefer(false)}
        recordType="crime_report"
        recordId={report.id}
        snapshot={{
          title: report.title,
          plate: report.plate,
          severity: report.severity,
          location: `${report.location}, ${report.lga}, ${report.state}`,
          summary: report.description,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", flex: 1 },
  headerCase: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2 },
  statusChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  content: { padding: 14, gap: 12 },
  metaRow: { flexDirection: "row", borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  metaItem: { flex: 1, padding: 12, alignItems: "center" },
  metaLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 3 },
  metaValue: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  cardSectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, gap: 12 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1 },
  suspectRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  suspectStatus: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 70, textAlignVertical: "top" },
  addNoteBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  referBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  referIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  referTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  referSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
