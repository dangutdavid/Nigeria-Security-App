import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAgency } from "@/context/AgencyContext";
import { useAuth } from "@/context/AuthContext";
import {
  Referral,
  ReferralRecordType,
  ReferralStatus,
  REFERRAL_STATUS_LABELS,
  useReferrals,
} from "@/context/ReferralContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";

const RECORD_ICON: Record<ReferralRecordType, keyof typeof Feather.glyphMap> = {
  incident: "alert-triangle",
  crime_report: "shield",
  inspection: "clipboard",
  theft_report: "truck",
};

const RECORD_LABEL: Record<ReferralRecordType, string> = {
  incident: "Road Incident",
  crime_report: "Crime Report",
  inspection: "Vehicle Inspection",
  theft_report: "Stolen Vehicle",
};

const STATUS_FLOW: ReferralStatus[] = ["pending", "acknowledged", "actioned", "closed"];

function relativeTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReferralsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { getAgencyById } = useAgency();
  const { inboxFor, outboxFor, updateReferralStatus, addReferralNote } = useReferrals();

  const [tab, setTab] = useState<"inbox" | "outbox">("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const agency = user?.agency ?? "frsc";
  const agencyColor = getAgencyById(agency)?.primaryColor ?? colors.primary;
  const canAct = can("edit", "referral");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const inbox = useMemo(() => inboxFor(agency), [inboxFor, agency]);
  const outbox = useMemo(() => outboxFor(agency), [outboxFor, agency]);
  const list = tab === "inbox" ? inbox : outbox;
  const pendingCount = inbox.filter((r) => r.status === "pending").length;

  const selected = useMemo(
    () => [...inbox, ...outbox].find((r) => r.id === selectedId) ?? null,
    [inbox, outbox, selectedId]
  );

  function statusColor(status: ReferralStatus): string {
    switch (status) {
      case "pending":
        return colors.warning;
      case "acknowledged":
        return colors.info;
      case "actioned":
        return colors.success;
      case "closed":
        return colors.mutedForeground;
    }
  }

  function openRecord(r: Referral) {
    setSelectedId(null);
    switch (r.recordType) {
      case "incident":
        router.push(`/case/${r.recordId}`);
        break;
      case "crime_report":
        router.push(`/crime/${r.recordId}`);
        break;
      case "inspection":
        router.push(`/inspection/${r.recordId}`);
        break;
      case "theft_report":
        router.push("/theft-alerts");
        break;
    }
  }

  async function advanceStatus(r: Referral) {
    const idx = STATUS_FLOW.indexOf(r.status);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    if (next === r.status) return;
    Haptics.selectionAsync();
    await updateReferralStatus(r.id, next);
  }

  async function submitNote(r: Referral) {
    if (!noteText.trim() || !user) return;
    await addReferralNote(r.id, noteText, user.name, user.agency);
    setNoteText("");
    Haptics.selectionAsync();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: agencyColor, paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referrals</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={styles.headerSub}>Cross-agency collaboration</Text>

        <View style={styles.tabs}>
          {(["inbox", "outbox"] as const).map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, { backgroundColor: active ? "#fff" : "rgba(255,255,255,0.15)" }]}
              >
                <Text style={[styles.tabText, { color: active ? agencyColor : "#fff" }]}>
                  {t === "inbox" ? "Inbox" : "Sent"}
                </Text>
                {t === "inbox" && pendingCount > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: active ? agencyColor : "#fff" }]}>
                    <Text style={[styles.tabBadgeText, { color: active ? "#fff" : agencyColor }]}>{pendingCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: agencyColor + "12" }]}>
              <Feather name={tab === "inbox" ? "inbox" : "send"} size={26} color={agencyColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {tab === "inbox" ? "No referrals received" : "No referrals sent"}
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {tab === "inbox"
                ? "Records shared with your agency by others will appear here."
                : "Records you refer to other agencies will appear here."}
            </Text>
          </View>
        ) : (
          list.map((r) => {
            const counterAgency = tab === "inbox" ? r.fromAgency : r.toAgency;
            const ag = getAgencyById(counterAgency);
            const agColor = ag?.primaryColor ?? colors.primary;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setSelectedId(r.id)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardDir}>
                    <Feather name={tab === "inbox" ? "arrow-down-left" : "arrow-up-right"} size={13} color={agColor} />
                    <Text style={[styles.cardDirText, { color: agColor }]}>
                      {tab === "inbox" ? "From" : "To"} {ag?.shortName ?? counterAgency}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(r.status) + "18" }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(r.status) }]} />
                    <Text style={[styles.statusText, { color: statusColor(r.status) }]}>
                      {REFERRAL_STATUS_LABELS[r.status]}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={[styles.recordIcon, { backgroundColor: agencyColor + "12" }]}>
                    <Feather name={RECORD_ICON[r.recordType]} size={16} color={agencyColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                      {r.snapshot.title}
                    </Text>
                    <Text style={[styles.cardType, { color: colors.mutedForeground }]}>
                      {RECORD_LABEL[r.recordType]} · {relativeTime(r.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardMetaRow}>
                  {r.snapshot.plate ? (
                    <View style={[styles.plateChip, { backgroundColor: colors.info + "18" }]}>
                      <Feather name="hash" size={11} color={colors.info} />
                      <Text style={[styles.plateText, { color: colors.info }]}>{r.snapshot.plate}</Text>
                    </View>
                  ) : null}
                  {r.notes.length > 0 && (
                    <View style={styles.metaItem}>
                      <Feather name="message-square" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{r.notes.length}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelectedId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.sheetHeader}>
                  <View style={[styles.recordIcon, { backgroundColor: agencyColor + "12" }]}>
                    <Feather name={RECORD_ICON[selected.recordType]} size={18} color={agencyColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>{selected.snapshot.title}</Text>
                    <Text style={[styles.cardType, { color: colors.mutedForeground }]}>
                      {RECORD_LABEL[selected.recordType]}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {/* Direction + status */}
                <View style={styles.sheetMetaRow}>
                  <View style={styles.metaItem}>
                    <Feather name="git-pull-request" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {getAgencyById(selected.fromAgency)?.shortName} → {getAgencyById(selected.toAgency)?.shortName}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(selected.status) + "18" }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(selected.status) }]} />
                    <Text style={[styles.statusText, { color: statusColor(selected.status) }]}>
                      {REFERRAL_STATUS_LABELS[selected.status]}
                    </Text>
                  </View>
                </View>

                {selected.snapshot.plate || selected.snapshot.location ? (
                  <View style={styles.sheetChips}>
                    {selected.snapshot.plate ? (
                      <View style={[styles.plateChip, { backgroundColor: colors.info + "18" }]}>
                        <Feather name="hash" size={11} color={colors.info} />
                        <Text style={[styles.plateText, { color: colors.info }]}>{selected.snapshot.plate}</Text>
                      </View>
                    ) : null}
                    {selected.snapshot.location ? (
                      <View style={styles.metaItem}>
                        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{selected.snapshot.location}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {selected.snapshot.summary ? (
                  <Text style={[styles.summary, { color: colors.text }]}>{selected.snapshot.summary}</Text>
                ) : null}

                <Text style={[styles.sheetMeta, { color: colors.mutedForeground }]}>
                  Referred by {selected.createdByName} · {relativeTime(selected.createdAt)}
                </Text>

                <TouchableOpacity
                  onPress={() => openRecord(selected)}
                  style={[styles.openBtn, { borderColor: agencyColor }]}
                >
                  <Feather name="external-link" size={15} color={agencyColor} />
                  <Text style={[styles.openBtnText, { color: agencyColor }]}>Open full record</Text>
                </TouchableOpacity>

                {/* Notes thread */}
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
                {selected.notes.length === 0 ? (
                  <Text style={[styles.noNotes, { color: colors.mutedForeground }]}>No notes yet.</Text>
                ) : (
                  selected.notes.map((n) => {
                    const nColor = getAgencyById(n.agency)?.primaryColor ?? colors.primary;
                    return (
                      <View key={n.id} style={[styles.note, { backgroundColor: colors.muted }]}>
                        <View style={styles.noteHead}>
                          <Text style={[styles.noteAuthor, { color: colors.text }]}>{n.authorName}</Text>
                          <View style={[styles.noteAgency, { backgroundColor: nColor + "1A" }]}>
                            <Text style={[styles.noteAgencyText, { color: nColor }]}>
                              {getAgencyById(n.agency)?.shortName ?? n.agency}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.noteText, { color: colors.text }]}>{n.text}</Text>
                        <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>{relativeTime(n.createdAt)}</Text>
                      </View>
                    );
                  })
                )}

                {canAct && (
                  <>
                    <View style={styles.noteInputRow}>
                      <TextInput
                        value={noteText}
                        onChangeText={setNoteText}
                        placeholder="Add a note…"
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.noteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      />
                      <TouchableOpacity
                        onPress={() => submitNote(selected)}
                        disabled={!noteText.trim()}
                        style={[styles.noteSend, { backgroundColor: noteText.trim() ? agencyColor : colors.muted }]}
                      >
                        <Feather name="send" size={16} color={noteText.trim() ? "#fff" : colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>

                    {selected.status !== "closed" && (
                      <TouchableOpacity
                        onPress={() => advanceStatus(selected)}
                        style={[styles.statusBtn, { backgroundColor: agencyColor }]}
                      >
                        <Feather name="chevrons-right" size={16} color="#fff" />
                        <Text style={styles.statusBtnText}>
                          {selected.status === "pending"
                            ? "Acknowledge"
                            : selected.status === "acknowledged"
                              ? "Mark as actioned"
                              : "Close referral"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 16 },
  tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, paddingVertical: 9, borderRadius: 10 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  tabBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  empty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 30 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 6 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },

  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardDir: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardDirText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardBody: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recordIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  cardType: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  plateChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  plateText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, maxHeight: "90%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#9AA5B1", marginBottom: 14, opacity: 0.4 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 22 },
  sheetMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sheetChips: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  summary: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginBottom: 12 },
  sheetMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 },
  openBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 11, paddingVertical: 12, marginBottom: 20 },
  openBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginBottom: 10 },
  noNotes: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  note: { borderRadius: 11, padding: 12, marginBottom: 10 },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  noteAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteAgency: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  noteAgencyText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  noteText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  noteTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5 },
  noteInputRow: { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 14 },
  noteInput: { flex: 1, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  noteSend: { width: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  statusBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, marginBottom: 6 },
  statusBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
