import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { listCitizenIncidentReports } from "@/services/citizenIncidentApi";

export default function AdminAuditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { allUsers } = useAuth();
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listCitizenIncidentReports>>>([]);
  useFocusEffect(useCallback(() => { void listCitizenIncidentReports().then(setReports); }, []));
  const events = useMemo(() => [
    ...reports.flatMap((r) => (r.timeline ?? []).map((t) => ({ id: `${r.reference}-${t.id}`, title: t.action, text: `${r.reference} · ${t.by}`, at: t.timestamp }))),
    ...allUsers.slice(0, 4).map((u) => ({ id: `user-${u.id}`, title: "User action placeholder", text: `${u.name} · ${u.role}`, at: u.createdAt })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [reports, allUsers]);
  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}>
      <Text style={[styles.title, { color: colors.text }]}>Audit activity</Text>
      {events.map((event) => <View key={event.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="activity" size={17} color="#344054" /><View style={{ flex: 1 }}><Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text><Text style={[styles.eventText, { color: colors.mutedForeground }]}>{event.text} · {new Date(event.at).toLocaleString()}</Text></View></View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  eventText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3, lineHeight: 17 },
});
