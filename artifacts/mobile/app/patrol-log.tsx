import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { usePatrol, PatrolEncounter } from "@/context/PatrolContext";
import { useColors } from "@/hooks/useColors";

const ROUTE_OPTIONS = [
  "Abuja–Lokoja Expressway",
  "Abuja–Kaduna Road",
  "Lagos–Ibadan Expressway",
  "Sagamu–Ore–Benin Highway",
  "Enugu–Port Harcourt Road",
  "Kano–Zaria Road",
  "Aba–Port Harcourt Road",
  "Benin–Warri Expressway",
  "Ilorin–Ogbomosho Road",
  "Maiduguri–Damaturu Highway",
];

const ENCOUNTER_TYPES: { type: PatrolEncounter["type"]; label: string; icon: string; color: string }[] = [
  { type: "vehicle_check", label: "Vehicle Check", icon: "truck", color: "#2C7BE5" },
  { type: "incident", label: "Incident", icon: "alert-triangle", color: "#C0392B" },
  { type: "checkpoint", label: "Checkpoint", icon: "map-pin", color: "#1B5E3B" },
  { type: "note", label: "General Note", icon: "file-text", color: "#C8960C" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: string, end?: string) {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function PatrolLogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { activeSession, sessions, startDuty, endDuty, setBreak, addEncounter, isOnDuty } = usePatrol();

  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showEncounterModal, setShowEncounterModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    route: string;
    duration: string;
    encounters: number;
    vehicleChecks: number;
    incidents: number;
    checkpoints: number;
    notes: number;
    km?: number;
  } | null>(null);
  const [selectedRoute, setSelectedRoute] = useState(ROUTE_OPTIONS[0]);
  const [endNotes, setEndNotes] = useState("");
  const [totalKm, setTotalKm] = useState("");
  const [encounterType, setEncounterType] = useState<PatrolEncounter["type"]>("vehicle_check");
  const [encounterDesc, setEncounterDesc] = useState("");
  const [encounterPlate, setEncounterPlate] = useState("");
  const [tab, setTab] = useState<"active" | "history">("active");
  const [tick, setTick] = useState(0);
  const [selectedSession, setSelectedSession] = useState<(typeof sessions)[number] | null>(null);

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [activeSession?.id]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  async function handleStartDuty() {
    if (!user) return;
    await startDuty(user.id, user.name, user.badgeNumber, selectedRoute);
    setShowStartModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleEndDuty() {
    if (activeSession) {
      const km = totalKm ? parseFloat(totalKm) : undefined;
      const enc = activeSession.encounters ?? [];
      setSummaryData({
        route: activeSession.route,
        duration: formatDuration(activeSession.startTime),
        encounters: enc.length,
        vehicleChecks: enc.filter((e) => e.type === "vehicle_check").length,
        incidents: enc.filter((e) => e.type === "incident").length,
        checkpoints: enc.filter((e) => e.type === "checkpoint").length,
        notes: enc.filter((e) => e.type === "note").length,
        km,
      });
    }
    await endDuty(endNotes, totalKm ? parseFloat(totalKm) : undefined);
    setShowEndModal(false);
    setEndNotes("");
    setTotalKm("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSummary(true);
  }

  async function handleShareSession(session: (typeof sessions)[number]) {
    const enc = session.encounters;
    const lines = [
      `FRSC PATROL LOG — ${session.officerName} (${session.officerBadge})`,
      `Route: ${session.route}`,
      `Date: ${new Date(session.startTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
      `Time: ${formatTime(session.startTime)} – ${session.endTime ? formatTime(session.endTime) : "ongoing"}`,
      `Duration: ${formatDuration(session.startTime, session.endTime)}`,
      session.totalKm ? `Distance: ${session.totalKm} km` : null,
      ``,
      `SUMMARY`,
      `Total entries: ${enc.length}`,
      `Vehicle checks: ${enc.filter((e) => e.type === "vehicle_check").length}`,
      `Incidents: ${enc.filter((e) => e.type === "incident").length}`,
      `Checkpoints: ${enc.filter((e) => e.type === "checkpoint").length}`,
      `Notes: ${enc.filter((e) => e.type === "note").length}`,
      session.notes ? `\nSession notes: ${session.notes}` : null,
      ``,
      `PATROL ENTRIES`,
      ...enc.map((e, i) => `${i + 1}. [${formatTime(e.timestamp)}] ${e.type.replace("_", " ").toUpperCase()}: ${e.description}${e.plate ? ` (${e.plate})` : ""}`),
    ].filter((l) => l !== null).join("\n");
    try {
      await Share.share({ message: lines, title: "Patrol Log" });
    } catch {
      // dismissed
    }
  }

  async function handleAddEncounter() {
    if (!encounterDesc.trim()) {
      Alert.alert("Required", "Please enter a description.");
      return;
    }
    await addEncounter({
      type: encounterType,
      description: encounterDesc.trim(),
      plate: encounterPlate.trim() || undefined,
    });
    setEncounterDesc("");
    setEncounterPlate("");
    setShowEncounterModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const statusColor = activeSession?.status === "on_duty"
    ? colors.success
    : activeSession?.status === "on_break"
    ? colors.warning
    : colors.mutedForeground;

  const statusLabel = activeSession?.status === "on_duty"
    ? "On Duty"
    : activeSession?.status === "on_break"
    ? "On Break"
    : "Off Duty";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Duty & Patrol Log</Text>
          <View
            style={[styles.statusBadge, { backgroundColor: statusColor + "25", borderColor: statusColor + "50" }]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["active", "history"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tab,
              tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t === "active" ? "Active Session" : `History (${sessions.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "active" && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottomPad, paddingTop: 16, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Active session card */}
          {activeSession ? (
            <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sessionHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionRoute, { color: colors.text }]}>
                      {activeSession.route}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                      Started {formatTime(activeSession.startTime)} · {formatDuration(activeSession.startTime)} elapsed
                    </Text>
                  </View>
                  <Text style={[styles.encounterCount, { color: colors.primary }]}>
                    {activeSession.encounters.length} entries
                  </Text>
                </View>
                {/* Mini stats row */}
                {activeSession.encounters.length > 0 && (
                  <View style={[styles.miniStatsRow, { borderTopColor: colors.border }]}>
                    {[
                      { type: "vehicle_check", icon: "truck", color: "#2C7BE5", label: "Checks" },
                      { type: "incident", icon: "alert-triangle", color: "#C0392B", label: "Incidents" },
                      { type: "checkpoint", icon: "map-pin", color: "#1B5E3B", label: "Checkpts" },
                      { type: "note", icon: "file-text", color: "#C8960C", label: "Notes" },
                    ].map(({ type, icon, color, label }) => {
                      const count = activeSession.encounters.filter((e) => e.type === type).length;
                      return (
                        <View key={type} style={styles.miniStatItem}>
                          <Feather name={icon as any} size={14} color={count > 0 ? color : colors.border} />
                          <Text style={[styles.miniStatNum, { color: count > 0 ? colors.text : colors.border }]}>{count}</Text>
                          <Text style={[styles.miniStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.infoLight }]}
                    onPress={() => setShowEncounterModal(true)}
                  >
                    <Feather name="plus" size={16} color={colors.info} />
                    <Text style={[styles.actionBtnText, { color: colors.info }]}>Log Entry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: activeSession.status === "on_break"
                          ? colors.successLight
                          : colors.warningLight,
                      },
                    ]}
                    onPress={() => setBreak(activeSession.status !== "on_break")}
                  >
                    <Feather
                      name={activeSession.status === "on_break" ? "play" : "pause"}
                      size={16}
                      color={activeSession.status === "on_break" ? colors.success : colors.warning}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        {
                          color: activeSession.status === "on_break"
                            ? colors.success
                            : colors.warning,
                        },
                      ]}
                    >
                      {activeSession.status === "on_break" ? "Resume" : "Break"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.fatalLight }]}
                    onPress={() => setShowEndModal(true)}
                  >
                    <Feather name="square" size={16} color={colors.fatal} />
                    <Text style={[styles.actionBtnText, { color: colors.fatal }]}>End Duty</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Encounter log */}
              {activeSession.encounters.length === 0 ? (
                <View style={[styles.emptyEncounters, { borderColor: colors.border }]}>
                  <Feather name="clipboard" size={32} color={colors.border} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No entries yet. Tap "Log Entry" to record a vehicle check, incident, or note.
                  </Text>
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.encounterListTitle, { color: colors.mutedForeground, borderBottomColor: colors.border }]}>
                    PATROL ENTRIES
                  </Text>
                  {activeSession.encounters.map((enc, i) => (
                    <EncounterRow
                      key={enc.id}
                      encounter={enc}
                      colors={colors}
                      last={i === activeSession.encounters.length - 1}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.offDutyState}>
              <View style={[styles.offDutyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="moon" size={40} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.offDutyTitle, { color: colors.text }]}>
                You are Off Duty
              </Text>
              <Text style={[styles.offDutySub, { color: colors.mutedForeground }]}>
                Start a duty session to log patrol encounters, vehicle checks, and incidents.
              </Text>
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowStartModal(true)}
              >
                <Feather name="play" size={18} color="#fff" />
                <View style={styles.startBtnCopy}>
                  <Text style={styles.startBtnText}>Start Duty</Text>
                  <Text style={styles.startBtnSub}>Choose route and begin session</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {tab === "history" && sessions.length > 0 && (() => {
        const totalEnc = sessions.reduce((sum, s) => sum + s.encounters.length, 0);
        const totalKmAll = sessions.reduce((sum, s) => sum + (s.totalKm ?? 0), 0);
        const totalVehicle = sessions.reduce((sum, s) => sum + s.encounters.filter((e) => e.type === "vehicle_check").length, 0);
        return (
          <View style={[styles.historyLifetimeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "Sessions", value: sessions.length.toString() },
              { label: "Encounters", value: totalEnc.toString() },
              { label: "Checks", value: totalVehicle.toString() },
              ...(totalKmAll > 0 ? [{ label: "Total km", value: totalKmAll.toFixed(1) }] : []),
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={styles.historyLifetimeStat}>
                  <Text style={[styles.historyLifetimeVal, { color: colors.primary }]}>{item.value}</Text>
                  <Text style={[styles.historyLifetimeLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={[styles.historyLifetimeDivider, { backgroundColor: colors.border }]} />}
              </React.Fragment>
            ))}
          </View>
        );
      })()}

      {tab === "history" && (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 14, paddingBottom: bottomPad, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.offDutyState}>
              <Feather name="archive" size={40} color={colors.border} />
              <Text style={[styles.offDutyTitle, { color: colors.text }]}>No Past Sessions</Text>
              <Text style={[styles.offDutySub, { color: colors.mutedForeground }]}>
                Completed duty sessions will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.85}
              onPress={() => setSelectedSession(item)}
            >
              <View style={styles.historyTop}>
                <Text style={[styles.historyRoute, { color: colors.text }]}>{item.route}</Text>
                <Text style={[styles.historyDuration, { color: colors.primary }]}>
                  {formatDuration(item.startTime, item.endTime)}
                </Text>
              </View>
              <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                {new Date(item.startTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                {" · "}
                {formatTime(item.startTime)} – {item.endTime ? formatTime(item.endTime) : "ongoing"}
              </Text>
              <View style={styles.historyStats}>
                <View style={[styles.historyStatChip, { backgroundColor: colors.muted }]}>
                  <Feather name="clipboard" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.historyStatText, { color: colors.mutedForeground }]}>
                    {item.encounters.length} entries
                  </Text>
                </View>
                {item.totalKm ? (
                  <View style={[styles.historyStatChip, { backgroundColor: colors.muted }]}>
                    <Feather name="navigation" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.historyStatText, { color: colors.mutedForeground }]}>
                      {item.totalKm} km
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.historyStatChip, { backgroundColor: colors.muted }]}>
                  <Feather name="user" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.historyStatText, { color: colors.mutedForeground }]}>
                    {item.officerBadge}
                  </Text>
                </View>
              </View>
              {item.encounters.length > 0 && (
                <View style={[styles.historyTypeRow, { borderTopColor: colors.border }]}>
                  {[
                    { type: "vehicle_check", icon: "truck" as const, color: "#2C7BE5", label: "Checks" },
                    { type: "incident", icon: "alert-triangle" as const, color: "#C0392B", label: "Incidents" },
                    { type: "checkpoint", icon: "map-pin" as const, color: "#1B5E3B", label: "Checkpts" },
                    { type: "note", icon: "file-text" as const, color: "#C8960C", label: "Notes" },
                  ].map(({ type, icon, color, label }) => {
                    const cnt = item.encounters.filter((e) => e.type === type).length;
                    if (cnt === 0) return null;
                    return (
                      <View key={type} style={styles.historyTypeChip}>
                        <Feather name={icon} size={11} color={color} />
                        <Text style={[styles.historyTypeText, { color }]}>{cnt} {label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              {(() => {
                const incidentEncs = item.encounters.filter((e) => e.type === "incident");
                if (incidentEncs.length === 0) return null;
                return (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#C0392B20", backgroundColor: "#C0392B08" }}>
                    <Feather name="alert-triangle" size={12} color="#C0392B" />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#C0392B" }}>
                      {incidentEncs.length} incident{incidentEncs.length > 1 ? "s" : ""} logged during this session
                    </Text>
                  </View>
                );
              })()}
              {item.notes ? (
                <Text style={[styles.historyNotes, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
                  {item.notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Start duty modal */}
      <Modal visible={showStartModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Start Duty</Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                Select your patrol route for this session
              </Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {ROUTE_OPTIONS.map((route) => (
                  <TouchableOpacity
                    key={route}
                    onPress={() => setSelectedRoute(route)}
                    style={[
                      styles.routeOption,
                      {
                        backgroundColor: selectedRoute === route ? colors.primary + "15" : "transparent",
                        borderColor: selectedRoute === route ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name="navigation"
                      size={14}
                      color={selectedRoute === route ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.routeText,
                        { color: selectedRoute === route ? colors.primary : colors.text },
                      ]}
                    >
                      {route}
                    </Text>
                    {selectedRoute === route && (
                      <Feather name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowStartModal(false)}
                  style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStartDuty}
                  style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="play" size={14} color="#fff" />
                  <Text style={styles.modalConfirmText}>Start Duty</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!selectedSession} animationType="slide" transparent onRequestClose={() => setSelectedSession(null)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Patrol History</Text>
              {selectedSession ? (
                <>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                    {selectedSession.route}
                  </Text>
                  <Text style={[styles.sessionDetailText, { color: colors.text }]}>
                    {new Date(selectedSession.startTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                    {formatTime(selectedSession.startTime)} – {selectedSession.endTime ? formatTime(selectedSession.endTime) : "ongoing"}
                  </Text>
                  <Text style={[styles.sessionDetailText, { color: colors.mutedForeground }]}>
                    Officer: {selectedSession.officerName} ({selectedSession.officerBadge})
                  </Text>
                  <Text style={[styles.sessionDetailText, { color: colors.mutedForeground }]}>
                    Entries: {selectedSession.encounters.length} · Distance: {selectedSession.totalKm ?? "—"} km
                  </Text>
                  {selectedSession.notes ? (
                    <Text style={[styles.historyNotes, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
                      {selectedSession.notes}
                    </Text>
                  ) : null}
                  <View style={[styles.modalActions, { marginTop: 12 }]}>
                    <TouchableOpacity
                      style={[styles.modalCancelBtn, { borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                      onPress={() => handleShareSession(selectedSession)}
                    >
                      <Feather name="share-2" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => setSelectedSession(null)}
                    >
                      <Text style={styles.modalConfirmText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* End duty modal */}
      <Modal visible={showEndModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>End Duty</Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                Duration: {activeSession ? formatDuration(activeSession.startTime) : "—"} · {activeSession?.encounters.length ?? 0} entries
              </Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Session notes (optional)…"
                placeholderTextColor={colors.mutedForeground}
                value={endNotes}
                onChangeText={setEndNotes}
                multiline
                numberOfLines={3}
              />
              <View style={[styles.kmRow, { borderColor: colors.border }]}>
                <Feather name="navigation" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.kmInput, { color: colors.text }]}
                  placeholder="Total distance (km)"
                  placeholderTextColor={colors.mutedForeground}
                  value={totalKm}
                  onChangeText={setTotalKm}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowEndModal(false)}
                  style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEndDuty}
                  style={[styles.modalConfirmBtn, { backgroundColor: colors.destructive }]}
                >
                  <Feather name="square" size={14} color="#fff" />
                  <Text style={styles.modalConfirmText}>End Duty</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add encounter modal */}
      <Modal visible={showEncounterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Log Entry</Text>
              <View style={styles.encounterTypeRow}>
                {ENCOUNTER_TYPES.map((et) => (
                  <TouchableOpacity
                    key={et.type}
                    onPress={() => setEncounterType(et.type)}
                    style={[
                      styles.encounterTypeBtn,
                      {
                        backgroundColor: encounterType === et.type ? et.color + "18" : colors.muted,
                        borderColor: encounterType === et.type ? et.color : "transparent",
                      },
                    ]}
                  >
                    <Feather name={et.icon as any} size={16} color={encounterType === et.type ? et.color : colors.mutedForeground} />
                    <Text
                      style={[
                        styles.encounterTypeText,
                        { color: encounterType === et.type ? et.color : colors.mutedForeground },
                      ]}
                    >
                      {et.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {encounterType === "vehicle_check" && (
                <View style={[styles.kmRow, { borderColor: colors.border, marginBottom: 10 }]}>
                  <Feather name="truck" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.kmInput, { color: colors.text }]}
                    placeholder="Plate number"
                    placeholderTextColor={colors.mutedForeground}
                    value={encounterPlate}
                    onChangeText={setEncounterPlate}
                    autoCapitalize="characters"
                  />
                </View>
              )}
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Description…"
                placeholderTextColor={colors.mutedForeground}
                value={encounterDesc}
                onChangeText={setEncounterDesc}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => { setShowEncounterModal(false); setEncounterDesc(""); setEncounterPlate(""); }}
                  style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddEncounter}
                  style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.modalConfirmText}>Add Entry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Shift Summary Modal ── */}
      <Modal visible={showSummary} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.summarySheet, { backgroundColor: colors.card }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.success + "18" }]}>
              <Feather name="check-circle" size={32} color={colors.success} />
            </View>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Duty Ended</Text>
            {summaryData && (
              <>
                <Text style={[styles.summaryRoute, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {summaryData.route}
                </Text>

                <View style={[styles.summaryRow, { borderTopColor: colors.border, marginTop: 18 }]}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryItemValue, { color: colors.text }]}>{summaryData.duration}</Text>
                    <Text style={[styles.summaryItemLabel, { color: colors.mutedForeground }]}>Duration</Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryItemValue, { color: colors.text }]}>{summaryData.encounters}</Text>
                    <Text style={[styles.summaryItemLabel, { color: colors.mutedForeground }]}>Entries</Text>
                  </View>
                  {summaryData.km != null && (
                    <>
                      <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.summaryItem}>
                        <Text style={[styles.summaryItemValue, { color: colors.text }]}>{summaryData.km} km</Text>
                        <Text style={[styles.summaryItemLabel, { color: colors.mutedForeground }]}>Distance</Text>
                      </View>
                    </>
                  )}
                </View>

                {summaryData.encounters > 0 && (
                  <View style={[styles.summaryBreakdown, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    {summaryData.vehicleChecks > 0 && (
                      <View style={styles.bRow}>
                        <Feather name="truck" size={14} color="#2C7BE5" />
                        <Text style={[styles.bLabel, { color: colors.mutedForeground }]}>Vehicle checks</Text>
                        <Text style={[styles.bValue, { color: colors.text }]}>{summaryData.vehicleChecks}</Text>
                      </View>
                    )}
                    {summaryData.incidents > 0 && (
                      <View style={styles.bRow}>
                        <Feather name="alert-triangle" size={14} color="#C0392B" />
                        <Text style={[styles.bLabel, { color: colors.mutedForeground }]}>Incidents</Text>
                        <Text style={[styles.bValue, { color: colors.text }]}>{summaryData.incidents}</Text>
                      </View>
                    )}
                    {summaryData.checkpoints > 0 && (
                      <View style={styles.bRow}>
                        <Feather name="map-pin" size={14} color="#1B5E3B" />
                        <Text style={[styles.bLabel, { color: colors.mutedForeground }]}>Checkpoints</Text>
                        <Text style={[styles.bValue, { color: colors.text }]}>{summaryData.checkpoints}</Text>
                      </View>
                    )}
                    {summaryData.notes > 0 && (
                      <View style={styles.bRow}>
                        <Feather name="file-text" size={14} color="#C8960C" />
                        <Text style={[styles.bLabel, { color: colors.mutedForeground }]}>Notes</Text>
                        <Text style={[styles.bValue, { color: colors.text }]}>{summaryData.notes}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.summaryCloseBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowSummary(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.summaryCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EncounterRow({
  encounter,
  colors,
  last,
}: {
  encounter: PatrolEncounter;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  last: boolean;
}) {
  const et = ENCOUNTER_TYPES.find((e) => e.type === encounter.type) ?? ENCOUNTER_TYPES[3];
  return (
    <View
      style={[
        encStyles.row,
        { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : 1 },
      ]}
    >
      <View style={[encStyles.icon, { backgroundColor: et.color + "18" }]}>
        <Feather name={et.icon as any} size={14} color={et.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={encStyles.topRow}>
          <Text style={[encStyles.type, { color: et.color }]}>{et.label}</Text>
          <Text style={[encStyles.time, { color: colors.mutedForeground }]}>
            {formatTime(encounter.timestamp)}
          </Text>
        </View>
        <Text style={[encStyles.desc, { color: colors.text }]}>{encounter.description}</Text>
        {encounter.plate && (
          <Text style={[encStyles.plate, { color: colors.info }]}>
            Plate: {encounter.plate}
          </Text>
        )}
      </View>
    </View>
  );
}

const encStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  type: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  plate: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE2E7",
  },
  sessionRoute: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
  },
  sessionMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  encounterCount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  actionRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyEncounters: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  encounterListTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    padding: 12,
    borderBottomWidth: 1,
  },
  offDutyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
    paddingHorizontal: 30,
  },
  offDutyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  offDutyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  offDutySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  startBtnCopy: {
    alignItems: "flex-start",
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  startBtnSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  historyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  historyRoute: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  historyDuration: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  historyMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  historyStats: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  historyStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyStatText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  sessionDetailText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
  historyTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 8, marginTop: 4, borderTopWidth: 1 },
  historyTypeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.04)" },
  historyTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  historyLifetimeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginHorizontal: 14, marginTop: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  historyLifetimeStat: { alignItems: "center", flex: 1 },
  historyLifetimeVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  historyLifetimeLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  historyLifetimeDivider: { width: 1, height: 30 },
  historyNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },
  routeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  modalConfirmBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalConfirmText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  kmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kmInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  encounterTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  encounterTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  encounterTypeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  summarySheet: {
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  summaryRoute: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 1,
    paddingTop: 18,
    gap: 0,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryItemValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  summaryItemLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    alignSelf: "center",
  },
  summaryBreakdown: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
    gap: 10,
  },
  bRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  bValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  summaryCloseBtn: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  summaryCloseBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  miniStatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  miniStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  miniStatNum: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  miniStatLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
});
