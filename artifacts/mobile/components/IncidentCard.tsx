import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Incident, IncidentStatus, useIncidents } from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "./StatusBadge";

interface IncidentCardProps {
  incident: Incident;
}

const TYPE_ICONS: Record<string, string> = {
  crash: "alert-triangle",
  breakdown: "tool",
  hazard: "alert-circle",
  flooding: "droplet",
};

const STATUS_OPTIONS: Array<{ value: IncidentStatus; label: string; color: string }> = [
  { value: "submitted", label: "Submitted", color: "#2563EB" },
  { value: "assigned", label: "Assigned", color: "#7C3AED" },
  { value: "under_review", label: "Under Review", color: "#D97706" },
  { value: "closed", label: "Closed", color: "#059669" },
];

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  assigned: "Assigned",
  under_review: "Under Review",
  closed: "Closed",
};

export function IncidentCard({ incident }: IncidentCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { updateIncident } = useIncidents();
  const insets = useSafeAreaInsets();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [statusMode, setStatusMode] = useState(false);

  const canChangeStatus = user?.role === "supervisor" || user?.role === "commander";

  function closeSheet() {
    setSheetVisible(false);
    setNoteMode(false);
    setStatusMode(false);
    setNoteText("");
  }

  async function handleLongPress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSheetVisible(true);
    setNoteMode(false);
    setStatusMode(false);
  }

  async function submitNote() {
    if (!noteText.trim()) return;
    await updateIncident(incident.id, {
      timeline: [
        ...incident.timeline,
        {
          id: `TL-${Date.now()}`,
          action: `Note: ${noteText.trim()}`,
          by: user?.name ?? "Unknown",
          timestamp: new Date().toISOString(),
        },
      ],
    });
    setNoteText("");
    setNoteMode(false);
    setSheetVisible(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function changeStatus(status: IncidentStatus) {
    await updateIncident(incident.id, {
      status,
      timeline: [
        ...incident.timeline,
        {
          id: `TL-${Date.now()}`,
          action: `Status changed to ${STATUS_LABELS[status] ?? status}`,
          by: user?.name ?? "Unknown",
          timestamp: new Date().toISOString(),
        },
      ],
    });
    closeSheet();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function shareIncident() {
    const text = [
      `FRSC INCIDENT REPORT`,
      `ID: ${incident.id}`,
      `Title: ${incident.title}`,
      `Location: ${incident.location}, ${incident.lga}, ${incident.state}`,
      `Severity: ${incident.severity.toUpperCase()}`,
      `Status: ${(STATUS_LABELS[incident.status] ?? incident.status).toUpperCase()}`,
      `Date: ${new Date(incident.dateTime).toLocaleString()}`,
      incident.reportedByName ? `Reported by: ${incident.reportedByName}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await Share.share({ message: text, title: `FRSC ${incident.id}` });
    setSheetVisible(false);
  }

  const timeAgo = formatTimeAgo(incident.dateTime);
  const iconBg = getIconBg(incident.severity, colors);
  const iconColor = getIconColor(incident.severity, colors);

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/case/${incident.id}` as any)}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Feather
              name={(TYPE_ICONS[incident.type] as any) || "alert-triangle"}
              size={18}
              color={iconColor}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.id, { color: colors.mutedForeground }]}>{incident.id}</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {incident.title}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>

        <View style={styles.location}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {incident.location}
          </Text>
        </View>

        {(incident.state || incident.lga) && (
          <View style={styles.locationChips}>
            {incident.state ? (
              <View style={[styles.locChip, { backgroundColor: colors.infoLight }]}>
                <Feather name="flag" size={10} color={colors.info} />
                <Text style={[styles.locChipText, { color: colors.info }]}>{incident.state}</Text>
              </View>
            ) : null}
            {incident.lga ? (
              <View style={[styles.locChip, { backgroundColor: colors.muted }]}>
                <Feather name="map" size={10} color={colors.mutedForeground} />
                <Text style={[styles.locChipText, { color: colors.mutedForeground }]}>{incident.lga}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.badges}>
            <StatusBadge type="severity" value={incident.severity} small />
            <StatusBadge type="status" value={incident.status} small />
            {incident.victims.length > 0 && (
              <View style={[styles.countChip, { backgroundColor: colors.fatalLight }]}>
                <Feather name="user" size={9} color={colors.fatal} />
                <Text style={[styles.countChipText, { color: colors.fatal }]}>{incident.victims.length}</Text>
              </View>
            )}
            {incident.vehicles.length > 0 && (
              <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
                <Feather name="truck" size={9} color={colors.mutedForeground} />
                <Text style={[styles.countChipText, { color: colors.mutedForeground }]}>{incident.vehicles.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.timeRow}>
            {user?.id === incident.assignedTo && incident.status !== "closed" && (
              <View style={[styles.assignedMePill, { backgroundColor: colors.primary + "15" }]}>
                <View style={[styles.assignedMeDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.assignedMeText, { color: colors.primary }]}>Assigned</Text>
              </View>
            )}
            {incident.pendingSync && (
              <Feather name="cloud-off" size={12} color={colors.warning} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconWrap, { backgroundColor: iconBg }]}>
                <Feather
                  name={(TYPE_ICONS[incident.type] as any) || "alert-triangle"}
                  size={15}
                  color={iconColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetId, { color: colors.mutedForeground }]}>{incident.id}</Text>
                <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                  {incident.title}
                </Text>
              </View>
              <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />

            {noteMode ? (
              <View style={styles.notePane}>
                <TextInput
                  style={[
                    styles.noteInput,
                    {
                      backgroundColor: colors.muted,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Type a note for this incident…"
                  placeholderTextColor={colors.mutedForeground}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={[styles.noteBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                    onPress={() => { setNoteMode(false); setNoteText(""); }}
                  >
                    <Text style={[styles.noteBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.noteBtn, { backgroundColor: noteText.trim() ? colors.primary : colors.muted, borderColor: "transparent" }]}
                    onPress={submitNote}
                    disabled={!noteText.trim()}
                  >
                    <Text style={[styles.noteBtnText, { color: noteText.trim() ? "#fff" : colors.mutedForeground }]}>
                      Add Note
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : statusMode ? (
              <View style={styles.statusPane}>
                <Text style={[styles.statusPaneTitle, { color: colors.mutedForeground }]}>
                  Change status from{" "}
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.text }}>
                    {STATUS_LABELS[incident.status] ?? incident.status}
                  </Text>{" "}
                  to:
                </Text>
                {STATUS_OPTIONS.filter((s) => s.value !== incident.status).map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.statusOption, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => changeStatus(s.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.statusOptionText, { color: colors.text }]}>{s.label}</Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.cancelRow} onPress={() => setStatusMode(false)}>
                  <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>← Back</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actions}>
                <ActionRow
                  icon="eye"
                  label="View Details"
                  color={colors.primary}
                  onPress={() => { closeSheet(); router.push(`/case/${incident.id}` as any); }}
                />
                <ActionRow
                  icon="message-square"
                  label="Add Quick Note"
                  color={colors.secondary}
                  onPress={() => setNoteMode(true)}
                />
                {canChangeStatus && (
                  <ActionRow
                    icon="refresh-cw"
                    label="Change Status"
                    color={colors.warning}
                    onPress={() => setStatusMode(true)}
                  />
                )}
                <ActionRow
                  icon="share-2"
                  label="Share Report"
                  color={colors.mutedForeground}
                  onPress={shareIncident}
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ActionRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.actionRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getIconBg(severity: string, colors: ReturnType<typeof useColors>) {
  switch (severity) {
    case "fatal": return colors.fatalLight;
    case "serious": return colors.seriousLight;
    case "minor": return colors.minorLight;
    default: return colors.muted;
  }
}

function getIconColor(severity: string, colors: ReturnType<typeof useColors>) {
  switch (severity) {
    case "fatal": return colors.fatal;
    case "serious": return colors.serious;
    case "minor": return colors.minor;
    default: return colors.mutedForeground;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerText: {
    flex: 1,
    marginRight: 6,
  },
  id: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  locationChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
    marginTop: -4,
  },
  locChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  locChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  assignedMePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  assignedMeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  assignedMeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sheetIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetId: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 1,
  },
  sheetTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sheetDivider: {
    height: 1,
    marginBottom: 6,
  },
  actions: {
    paddingTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  notePane: {
    paddingTop: 8,
    gap: 12,
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  noteActions: {
    flexDirection: "row",
    gap: 10,
  },
  noteBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noteBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  statusPane: {
    paddingTop: 8,
    gap: 8,
  },
  statusPaneTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  cancelRow: {
    alignItems: "center",
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
