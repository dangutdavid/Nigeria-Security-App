import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  CitizenAgencyRoute,
  CitizenEmergencyLevel,
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  formatCitizenAgencyLabel,
  formatCitizenIncidentStatus,
  getCitizenReportCoordinatesText,
  getCitizenReportLocationText,
  getMapMetrics,
  hasCitizenReportCoordinates,
} from "@/services/citizenIncidentApi";

type StatusFilter = "all" | CitizenIncidentStatus;
type EmergencyFilter = "all" | CitizenEmergencyLevel;
type AgencyFilter = "all" | CitizenAgencyRoute;
type SourceFilter = "all" | "citizen" | "referral";

const STATUS_FILTERS: StatusFilter[] = ["all", "submitted", "triaged", "assigned", "in_progress", "resolved", "closed"];
const EMERGENCY_FILTERS: EmergencyFilter[] = ["all", "critical", "high", "medium", "low"];
const AGENCY_FILTERS: AgencyFilter[] = ["all", "frsc", "police", "vio", "civil_defence"];
const SOURCE_FILTERS: SourceFilter[] = ["all", "citizen", "referral"];

const EMERGENCY_COLORS: Record<CitizenEmergencyLevel, string> = {
  low: "#2E7D52",
  medium: "#C8960C",
  high: "#D35400",
  critical: "#C0392B",
};

export function CitizenReportMapFallback({
  title,
  subtitle,
  reports,
  accentColor,
  bottomPadding,
  showAgencyFilter = false,
  detailRouteForReport,
}: {
  title: string;
  subtitle: string;
  reports: CitizenIncidentReceipt[];
  accentColor: string;
  bottomPadding: number;
  showAgencyFilter?: boolean;
  detailRouteForReport?: (report: CitizenIncidentReceipt) => string | null;
}) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [emergency, setEmergency] = useState<EmergencyFilter>("all");
  const [agency, setAgency] = useState<AgencyFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [selected, setSelected] = useState<CitizenIncidentReceipt | null>(null);

  const filtered = useMemo(
    () => reports.filter((report) => {
      if (status !== "all" && report.status !== status) return false;
      if (emergency !== "all" && report.emergencyLevel !== emergency) return false;
      if (showAgencyFilter && agency !== "all" && report.suggestedAgency !== agency) return false;
      if (source === "referral") return false;
      return true;
    }),
    [agency, emergency, reports, showAgencyFilter, source, status],
  );

  const metrics = useMemo(() => getMapMetrics(filtered), [filtered]);
  const mapReady = filtered.filter(hasCitizenReportCoordinates);
  const noCoordinates = filtered.filter((report) => !hasCitizenReportCoordinates(report));

  function openDetail(report: CitizenIncidentReceipt) {
    const route = detailRouteForReport?.(report);
    if (route) {
      router.push(route as any);
      return;
    }
    setSelected(report);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: accentColor }]}>
          <Feather name="map" size={32} color="#fff" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.metricsGrid}>
          <Metric label="Reports" value={metrics.total} color={accentColor} />
          <Metric label="With GPS" value={metrics.withCoordinates} color="#1B5E3B" />
          <Metric label="Manual" value={metrics.withoutCoordinates} color="#C8960C" />
          <Metric label="Open" value={metrics.open} color="#D35400" />
        </View>

        <FilterRow values={STATUS_FILTERS} active={status} onChange={setStatus} label={statusLabel} />
        <FilterRow values={EMERGENCY_FILTERS} active={emergency} onChange={setEmergency} label={emergencyLabel} />
        {showAgencyFilter ? <FilterRow values={AGENCY_FILTERS} active={agency} onChange={setAgency} label={agencyLabel} /> : null}
        <FilterRow values={SOURCE_FILTERS} active={source} onChange={setSource} label={sourceLabel} />

        <SectionHeader title="Map-ready reports" count={mapReady.length} />
        {mapReady.map((report) => (
          <ReportLocationCard key={report.reference} report={report} colors={colors} accentColor={accentColor} onPress={() => openDetail(report)} />
        ))}
        {mapReady.length === 0 ? <EmptyText text="No reports with GPS coordinates match this filter." /> : null}

        <SectionHeader title="Manual location fallback" count={noCoordinates.length} />
        {noCoordinates.map((report) => (
          <ReportLocationCard key={report.reference} report={report} colors={colors} accentColor="#C8960C" onPress={() => openDetail(report)} />
        ))}
        {noCoordinates.length === 0 ? <EmptyText text="All matching reports have GPS coordinates." /> : null}
      </ScrollView>

      <ReportSummaryModal
        report={selected}
        onClose={() => setSelected(null)}
        colors={colors}
        accentColor={accentColor}
      />
    </View>
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
  onChange,
  label,
}: {
  values: T[];
  active: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {values.map((value) => {
        const selected = active === value;
        return (
          <TouchableOpacity
            key={value}
            onPress={() => onChange(value)}
            style={[styles.filterChip, { backgroundColor: selected ? "#344054" : colors.card, borderColor: selected ? "#344054" : colors.border }]}
          >
            <Text style={[styles.filterText, { color: selected ? "#fff" : colors.text }]}>{label(value)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{count}</Text>
    </View>
  );
}

function ReportLocationCard({
  report,
  colors,
  accentColor,
  onPress,
}: {
  report: CitizenIncidentReceipt;
  colors: ReturnType<typeof useColors>;
  accentColor: string;
  onPress: () => void;
}) {
  const coordinates = getCitizenReportCoordinatesText(report);
  const area = [report.lga, report.state].filter(Boolean).join(", ");
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.pin, { backgroundColor: accentColor + "16" }]}>
        <Feather name={coordinates ? "map-pin" : "navigation"} size={17} color={accentColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.reportTop}>
          <Text style={[styles.reference, { color: colors.text }]}>{report.reference}</Text>
          <Text style={[styles.status, { color: accentColor }]}>{formatCitizenIncidentStatus(report.status)}</Text>
        </View>
        <Text style={[styles.location, { color: colors.mutedForeground }]} numberOfLines={2}>
          {getCitizenReportLocationText(report)}
        </Text>
        {area ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>{area}</Text> : null}
        <View style={styles.badges}>
          <Text style={[styles.badge, { backgroundColor: EMERGENCY_COLORS[report.emergencyLevel] + "14", color: EMERGENCY_COLORS[report.emergencyLevel] }]}>
            {report.emergencyLevel.toUpperCase()}
          </Text>
          <Text style={[styles.badge, { backgroundColor: accentColor + "14", color: accentColor }]}>Citizen Report</Text>
          {coordinates ? <Text style={[styles.coordinates, { color: colors.mutedForeground }]}>{coordinates}</Text> : null}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function ReportSummaryModal({
  report,
  onClose,
  colors,
  accentColor,
}: {
  report: CitizenIncidentReceipt | null;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  accentColor: string;
}) {
  if (!report) return null;
  const submittedAt = new Date(report.submittedAt).toLocaleString();
  const coordinates = getCitizenReportCoordinatesText(report);
  const area = [report.lga, report.state].filter(Boolean).join(", ");

  return (
    <Modal transparent animationType="fade" visible={Boolean(report)} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{report.reference}</Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Citizen Report</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.muted }]}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <SummaryRow label="Incident type" value={report.incidentType.replace(/_/g, " ")} />
          <SummaryRow label="Agency" value={formatCitizenAgencyLabel(report.suggestedAgency)} />
          <SummaryRow label="Status" value={formatCitizenIncidentStatus(report.status)} />
          <SummaryRow label="Emergency" value={report.emergencyLevel.toUpperCase()} />
          <SummaryRow label="Submitted" value={submittedAt} />
          <SummaryRow label="Location" value={getCitizenReportLocationText(report)} />
          {area ? <SummaryRow label="Area" value={area} /> : null}
          {coordinates ? <SummaryRow label="Coordinates" value={coordinates} /> : <SummaryRow label="Coordinates" value="Not captured. Use manual location details." />}
          <TouchableOpacity onPress={onClose} style={[styles.modalDone, { backgroundColor: accentColor }]}>
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>;
}

function statusLabel(value: StatusFilter) {
  return value === "all" ? "All Status" : formatCitizenIncidentStatus(value);
}

function emergencyLabel(value: EmergencyFilter) {
  return value === "all" ? "All Emergency" : value.charAt(0).toUpperCase() + value.slice(1);
}

function agencyLabel(value: AgencyFilter) {
  return value === "all" ? "All Agencies" : formatCitizenAgencyLabel(value);
}

function sourceLabel(value: SourceFilter) {
  if (value === "all") return "All Sources";
  if (value === "citizen") return "Citizen Report";
  return "Agency Referral";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: 18, padding: 18, marginBottom: 14 },
  title: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 10 },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, marginTop: 6 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  metric: { width: "48.5%", borderWidth: 1, borderRadius: 12, padding: 12 },
  metricValue: { fontSize: 21, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  filters: { gap: 8, paddingVertical: 4 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionCount: { fontSize: 12, fontFamily: "Inter_700Bold" },
  reportCard: { flexDirection: "row", alignItems: "flex-start", gap: 11, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 9 },
  pin: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  reportTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  reference: { fontSize: 15, fontFamily: "Inter_700Bold" },
  status: { fontSize: 12, fontFamily: "Inter_700Bold" },
  location: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18, marginTop: 3 },
  meta: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontFamily: "Inter_700Bold" },
  coordinates: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emptyText: { textAlign: "center", fontSize: 13, fontFamily: "Inter_600SemiBold", marginVertical: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 18 },
  modalCard: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  closeButton: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryRow: { borderTopWidth: 1, borderTopColor: "rgba(107,114,128,0.18)", paddingTop: 10 },
  summaryLabel: { color: "#6B7280", fontSize: 11, fontFamily: "Inter_700Bold", marginBottom: 3 },
  summaryValue: { color: "#111827", fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18, textTransform: "capitalize" },
  modalDone: { minHeight: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 4 },
  modalDoneText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
