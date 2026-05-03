import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useIncidents, IncidentStatus, Victim, Vehicle } from "@/context/IncidentContext";
import { Modal } from "react-native";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";

const STATUS_ACTIONS: Record<IncidentStatus, Array<{ label: string; next: IncidentStatus; color: string; icon: string }>> = {
  draft: [{ label: "Submit Report", next: "submitted", color: "#2C7BE5", icon: "send" }],
  submitted: [{ label: "Assign for Review", next: "assigned", color: "#E67E22", icon: "user-check" }],
  assigned: [{ label: "Begin Review", next: "under_review", color: "#C8960C", icon: "eye" }],
  under_review: [{ label: "Close Case", next: "closed", color: "#27AE60", icon: "check-circle" }],
  closed: [],
};

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

const CONDITION_COLORS: Record<string, string> = {
  deceased: "#8B0000",
  critical: "#C0392B",
  injured: "#E67E22",
  unhurt: "#27AE60",
};

export default function CaseDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getIncident, updateIncident } = useIncidents();
  const { user, allUsers } = useAuth();

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const incident = getIncident(id as string);
  const assignableUsers = allUsers.filter(
    (u) => u.status === "active" && u.id !== incident?.reportedBy
  );

  async function shareCase() {
    if (!incident) return;
    const victims = incident.victims.length > 0
      ? `\nVictims: ${incident.victims.length} (${incident.victims.map((v) => v.condition).join(", ")})`
      : "";
    const vehicles = incident.vehicles.length > 0
      ? `\nVehicles: ${incident.vehicles.map((v) => v.plate || "N/A").join(", ")}`
      : "";
    const text = [
      `FRSC INCIDENT REPORT`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `Case ID: ${incident.id}`,
      `Type: ${incident.type.toUpperCase()}`,
      `Severity: ${incident.severity.toUpperCase()}`,
      `Status: ${incident.status.replace("_", " ").toUpperCase()}`,
      ``,
      `Title: ${incident.title}`,
      `Location: ${incident.location}${incident.state ? ` · ${incident.state}` : ""}${incident.lga ? ` / ${incident.lga}` : ""}`,
      `Date/Time: ${formatDate(incident.dateTime)}`,
      `Reported by: ${incident.reportedByName}`,
      `${incident.assignedToName ? `Assigned to: ${incident.assignedToName}` : "Unassigned"}`,
      victims,
      vehicles,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `FRSC Field Operations App`,
    ].filter((l) => l !== "").join("\n");

    try {
      await Share.share({ message: text, title: `FRSC Case ${incident.id}` });
    } catch {
      // dismissed
    }
  }

  if (!incident) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, fontSize: 18 }}>Case not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 10 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const actions = STATUS_ACTIONS[incident.status];
  const canTakeAction =
    user?.role === "supervisor" || user?.role === "commander" || incident.reportedBy === user?.id;

  async function advanceStatus(next: IncidentStatus) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newTimeline = [
      ...(incident?.timeline ?? []),
      {
        id: Date.now().toString(),
        action: `Status changed to ${next.replace("_", " ")}`,
        by: user?.name || "",
        timestamp: new Date().toISOString(),
      },
    ];
    await updateIncident(id as string, { status: next, timeline: newTimeline });
    Alert.alert("Updated", `Case status updated to ${next.replace("_", " ")}`);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    const newTimeline = [
      ...(incident?.timeline ?? []),
      {
        id: Date.now().toString(),
        action: `Note: ${noteText.trim()}`,
        by: user?.name || "",
        timestamp: new Date().toISOString(),
      },
    ];
    await updateIncident(id as string, { timeline: newTimeline });
    setNoteText("");
    setAddingNote(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function assignToOfficer(officerId: string, officerName: string) {
    const newTimeline = [
      ...(incident?.timeline ?? []),
      {
        id: Date.now().toString(),
        action: `Assigned to ${officerName}`,
        by: user?.name || "",
        timestamp: new Date().toISOString(),
      },
    ];
    await updateIncident(id as string, {
      assignedTo: officerId,
      assignedToName: officerName,
      timeline: newTimeline,
    });
    setShowAssignModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Assigned", `Case assigned to ${officerName}.`);
  }

  const canAssign = (user?.role === "supervisor" || user?.role === "commander") && incident?.status !== "closed";

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const sevColors: Record<string, string> = {
    fatal: colors.fatal,
    serious: colors.serious,
    minor: colors.minor,
    property_only: colors.property,
  };
  const sevColor = sevColors[incident.severity] || colors.mutedForeground;

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
            borderLeftWidth: 4,
            borderLeftColor: sevColor,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.caseId, { color: colors.mutedForeground }]}>{incident.id}</Text>
            <Text style={[styles.caseTitle, { color: colors.text }]} numberOfLines={2}>
              {incident.title}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {incident.pendingSync && (
              <Feather name="cloud-off" size={18} color={colors.warning} />
            )}
            <TouchableOpacity onPress={shareCase} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="share-2" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.badgesRow}>
          <StatusBadge type="severity" value={incident.severity} />
          <StatusBadge type="status" value={incident.status} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {incident.location}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatDate(incident.dateTime)}
            </Text>
          </View>
        </View>

        {/* State / LGA row */}
        {(incident.state || incident.lga) && (
          <View style={[styles.metaRow, { flexDirection: "row", flexWrap: "wrap" }]}>
            {incident.state ? (
              <View style={[styles.metaChip, { backgroundColor: colors.infoLight }]}>
                <Feather name="flag" size={11} color={colors.info} />
                <Text style={[styles.metaChipText, { color: colors.info }]}>{incident.state}</Text>
              </View>
            ) : null}
            {incident.lga ? (
              <View style={[styles.metaChip, { backgroundColor: colors.muted }]}>
                <Feather name="layers" size={11} color={colors.mutedForeground} />
                <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>{incident.lga}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Actions */}
        {canTakeAction && actions.length > 0 && (
          <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              ACTIONS
            </Text>
            <View style={{ gap: 8 }}>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.next}
                  style={[styles.actionBtn, { backgroundColor: action.color }]}
                  onPress={() => advanceStatus(action.next)}
                  activeOpacity={0.85}
                >
                  <Feather name={action.icon as any} size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {incident.description ? (
          <Section title="DESCRIPTION" colors={colors}>
            <Text style={[styles.descText, { color: colors.text }]}>
              {incident.description}
            </Text>
          </Section>
        ) : null}

        {/* Vehicles */}
        {incident.vehicles.length > 0 && (
          <Section title={`VEHICLES (${incident.vehicles.length})`} colors={colors}>
            {incident.vehicles.map((v: Vehicle) => (
              <View key={v.id} style={[styles.subItem, { borderColor: colors.border }]}>
                <View style={styles.plateRow}>
                  <View style={[styles.plateBadge, { backgroundColor: "#F5F5DC", borderColor: "#C8960C" }]}>
                    <Text style={styles.plateText}>{v.plate || "No plate"}</Text>
                  </View>
                  <Text style={[styles.vehicleType, { color: colors.mutedForeground }]}>
                    {v.type}
                  </Text>
                </View>
                <Text style={[styles.vehicleInfo, { color: colors.text }]}>
                  {[v.make, v.model, v.colour].filter(Boolean).join(" · ") || "Details pending"}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* Victims */}
        {incident.victims.length > 0 && (
          <Section title={`VICTIMS / CASUALTIES (${incident.victims.length})`} colors={colors}>
            {incident.victims.map((v: Victim) => (
              <View key={v.id} style={[styles.subItem, { borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={[styles.victimName, { color: colors.text }]}>
                    {v.name || "Unknown"}
                  </Text>
                  <View style={[styles.conditionBadge, { backgroundColor: CONDITION_COLORS[v.condition] + "20" }]}>
                    <Text style={[styles.conditionText, { color: CONDITION_COLORS[v.condition] }]}>
                      {v.condition}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.victimDetails, { color: colors.mutedForeground }]}>
                  {[v.age ? `Age ${v.age}` : null, v.gender, v.hospital ? `Admitted: ${v.hospital}` : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* Evidence */}
        {incident.evidence.length > 0 && (
          <Section title={`EVIDENCE (${incident.evidence.length})`} colors={colors}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {incident.evidence.map((uri, idx) => (
                <View key={uri} style={styles.evidenceItem}>
                  <Image source={{ uri }} style={styles.evidenceImg} resizeMode="cover" />
                  <Text style={[styles.evidenceIdx, { color: colors.mutedForeground }]}>#{idx + 1}</Text>
                </View>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Assignment */}
        <Section title="ASSIGNMENT" colors={colors}>
          <View style={styles.assignRow}>
            <View style={styles.assignItem}>
              <Text style={[styles.assignLabel, { color: colors.mutedForeground }]}>Reported by</Text>
              <Text style={[styles.assignValue, { color: colors.text }]}>{incident.reportedByName}</Text>
            </View>
            <View style={styles.assignItem}>
              <Text style={[styles.assignLabel, { color: colors.mutedForeground }]}>Assigned to</Text>
              {incident.assignedToName ? (
                <Text style={[styles.assignValue, { color: colors.text }]}>{incident.assignedToName}</Text>
              ) : (
                <Text style={[styles.assignValue, { color: colors.mutedForeground }]}>Unassigned</Text>
              )}
            </View>
          </View>
          {canAssign && (
            <TouchableOpacity
              onPress={() => setShowAssignModal(true)}
              style={[styles.assignBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
            >
              <Feather name="user-check" size={15} color={colors.primary} />
              <Text style={[styles.assignBtnText, { color: colors.primary }]}>
                {incident.assignedToName ? "Reassign Case" : "Assign to Officer"}
              </Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Assign modal */}
        <Modal visible={showAssignModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Assign Case</Text>
                <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                Select an active officer to assign this case
              </Text>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {assignableUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => assignToOfficer(u.id, u.name)}
                    style={[
                      styles.assigneeRow,
                      {
                        backgroundColor: incident.assignedTo === u.id ? colors.primary + "12" : "transparent",
                        borderColor: incident.assignedTo === u.id ? colors.primary + "40" : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.assigneeAvatar, { backgroundColor: colors.primary + "18" }]}>
                      <Text style={[styles.assigneeInitials, { color: colors.primary }]}>
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.assigneeName, { color: colors.text }]}>{u.name}</Text>
                      <Text style={[styles.assigneeBadge, { color: colors.mutedForeground }]}>
                        {u.badgeNumber} · {u.station}
                      </Text>
                    </View>
                    {incident.assignedTo === u.id && (
                      <Feather name="check" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                {assignableUsers.length === 0 && (
                  <Text style={[styles.modalSub, { color: colors.mutedForeground, textAlign: "center", padding: 20 }]}>
                    No active officers available
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Timeline */}
        <Section title="TIMELINE" colors={colors}>
          {incident.timeline.map((entry, idx) => (
            <View key={entry.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                {idx < incident.timeline.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={styles.timelineRight}>
                <Text style={[styles.timelineAction, { color: colors.text }]}>{entry.action}</Text>
                <Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>
                  {entry.by} · {formatDate(entry.timestamp)}
                </Text>
              </View>
            </View>
          ))}

          {/* Add note */}
          {!addingNote ? (
            <TouchableOpacity
              style={[styles.addNoteBtn, { borderColor: colors.border }]}
              onPress={() => setAddingNote(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.addNoteText, { color: colors.primary }]}>Add note</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.noteInput, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <TextInput
                style={[styles.noteTextInput, { color: colors.text }]}
                placeholder="Write a note…"
                placeholderTextColor={colors.mutedForeground}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                autoFocus
              />
              <View style={styles.noteActions}>
                <TouchableOpacity onPress={() => setAddingNote(false)}>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.noteSubmit, { backgroundColor: colors.primary }]}
                  onPress={addNote}
                >
                  <Text style={styles.noteSubmitText}>Add Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  backBtn: { paddingTop: 2 },
  caseId: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  caseTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  metaRow: {
    gap: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  metaChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: { flex: 1 },
  section: {
    marginTop: 18,
    paddingHorizontal: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    padding: 14,
  },
  actionsCard: {
    margin: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  descText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  subItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  plateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  plateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  plateText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#333",
    letterSpacing: 0.5,
  },
  vehicleType: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
  },
  vehicleInfo: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  victimName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  conditionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  victimDetails: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  evidenceItem: {
    width: 110,
    alignItems: "center",
  },
  evidenceImg: {
    width: 110,
    height: 90,
    borderRadius: 10,
  },
  evidenceIdx: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "center",
  },
  assignRow: {
    flexDirection: "row",
    gap: 20,
  },
  assignItem: {
    flex: 1,
  },
  assignLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 3,
  },
  assignValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    minHeight: 50,
  },
  timelineLeft: {
    alignItems: "center",
    width: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    marginBottom: -4,
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineAction: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  timelineMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  addNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 8,
  },
  addNoteText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  noteInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
  },
  noteTextInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 70,
    textAlignVertical: "top",
  },
  noteActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  noteSubmit: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  noteSubmitText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  assignBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  modalSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  assigneeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeInitials: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  assigneeName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  assigneeBadge: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
