import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToolBackHeader } from "@/components/ToolBackHeader";
import { useColors } from "@/hooks/useColors";
import {
  AuditEvent,
  AuditSeverity,
  getAuditMetrics,
} from "@/services/auditLogService";
import { listAuditEvents } from "@/services/auditRepository";

type SeverityFilter = "all" | AuditSeverity;
type AgencyFilter = "all" | "frsc" | "police" | "vio" | "civil_defence" | "admin";

const SEVERITIES: SeverityFilter[] = ["all", "critical", "warning", "info"];
const AGENCIES: AgencyFilter[] = ["all", "frsc", "police", "vio", "civil_defence", "admin"];
const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  info: "#344054",
  warning: "#C8960C",
  critical: "#C0392B",
};

export default function AdminAuditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, last24h: 0, warnings: 0, critical: 0 });
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [agency, setAgency] = useState<AgencyFilter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [nextEvents, localMetrics] = await Promise.all([
      listAuditEvents({ severity, agency, query }),
      getAuditMetrics(),
    ]);
    setEvents(nextEvents);
    // Compute metrics from whichever trail we're actually displaying
    // (backend when API mode is on); local metrics remain the fallback.
    if (nextEvents.length > 0) {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      setMetrics({
        total: nextEvents.length,
        last24h: nextEvents.filter((e) => new Date(e.createdAt).getTime() >= dayAgo).length,
        warnings: nextEvents.filter((e) => e.severity === "warning").length,
        critical: nextEvents.filter((e) => e.severity === "critical").length,
      });
    } else {
      setMetrics(localMetrics);
    }
  }, [agency, query, severity]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleEvents = useMemo(() => events.slice(0, 120), [events]);

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}>
      <ToolBackHeader title="Admin Tools" />
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Audit Activity</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Security-sensitive actions, report changes, and admin operations.</Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="Total" value={metrics.total} color="#344054" />
        <Metric label="24h" value={metrics.last24h} color="#0F4C81" />
        <Metric label="Warnings" value={metrics.warnings} color="#C8960C" />
        <Metric label="Critical" value={metrics.critical} color="#C0392B" />
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search actor, reference, action..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.text }]}
          onSubmitEditing={load}
        />
      </View>

      <FilterRow values={SEVERITIES} active={severity} setActive={setSeverity} label={severityLabel} />
      <FilterRow values={AGENCIES} active={agency} setActive={setAgency} label={agencyLabel} />

      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: colors.text }]}>Events</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{visibleEvents.length}</Text>
      </View>

      {visibleEvents.map((event) => <AuditCard key={event.id} event={event} />)}
      {visibleEvents.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shield" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No audit events match this filter.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function FilterRow<T extends string>({
  values,
  active,
  setActive,
  label,
}: {
  values: T[];
  active: T;
  setActive: (value: T) => void;
  label: (value: T) => string;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {values.map((value) => {
        const selected = active === value;
        return (
          <TouchableOpacity key={value} onPress={() => setActive(value)} style={[styles.filter, { backgroundColor: selected ? "#344054" : colors.card, borderColor: selected ? "#344054" : colors.border }]}>
            <Text style={[styles.filterText, { color: selected ? "#fff" : colors.text }]}>{label(value)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function AuditCard({ event }: { event: AuditEvent }) {
  const colors = useColors();
  const severityColor = SEVERITY_COLORS[event.severity];
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: severityColor + "16" }]}>
        <Feather name={iconForType(event.type)} size={17} color={severityColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
          <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
          <Text style={[styles.severity, { color: severityColor }]}>{event.severity.toUpperCase()}</Text>
        </View>
        <Text style={[styles.eventText, { color: colors.mutedForeground }]}>{event.detail}</Text>
        <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>
          {event.actor.name}
          {event.actor.agency ? ` · ${agencyLabel(event.actor.agency as AgencyFilter)}` : ""}
          {event.reportReference ? ` · ${event.reportReference}` : ""}
          {` · ${new Date(event.createdAt).toLocaleString()}`}
        </Text>
      </View>
    </View>
  );
}

function severityLabel(value: SeverityFilter) {
  return value === "all" ? "All Severity" : value.charAt(0).toUpperCase() + value.slice(1);
}

function agencyLabel(value: AgencyFilter | string) {
  const labels: Record<string, string> = {
    all: "All Agencies",
    frsc: "FRSC",
    police: "Police",
    vio: "VIO",
    civil_defence: "NSCDC",
    admin: "Admin",
    citizen: "Citizen",
  };
  return labels[value] ?? value;
}

function iconForType(type: AuditEvent["type"]): keyof typeof Feather.glyphMap {
  if (type.startsWith("auth.")) return "log-in";
  if (type.startsWith("user.")) return "user-check";
  if (type.startsWith("agency.")) return "shield";
  if (type.startsWith("notification.")) return "bell";
  return "activity";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { marginBottom: 14 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, marginTop: 4 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  metric: { width: "48.5%", borderWidth: 1, borderRadius: 14, padding: 12 },
  metricValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  searchBox: { minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  filters: { gap: 8, paddingVertical: 4 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 10 },
  listTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  count: { fontSize: 12, fontFamily: "Inter_700Bold" },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  eventTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  severity: { fontSize: 10, fontFamily: "Inter_700Bold" },
  eventText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4, lineHeight: 17 },
  eventMeta: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 8, lineHeight: 16 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 22, alignItems: "center", gap: 9 },
  emptyText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
