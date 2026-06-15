import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  CitizenIncidentReceipt,
  formatCitizenIncidentStatus,
  getCitizenReportLocationText,
  hasCitizenReportCoordinates,
} from "@/services/citizenIncidentApi";

import {
  CitizenReportMapProps,
  ReportLocationCard,
  ReportSummaryModal,
} from "./CitizenReportMapFallback";

// Pin colour per agency so the Admin cross-agency view is legible at a glance.
const AGENCY_PIN_COLORS: Record<string, string> = {
  frsc: "#1B5E3B",
  police: "#1A3A6C",
  vio: "#7B3F00",
  civil_defence: "#234E2A",
};

// Centred on Nigeria, matching the FRSC native map.
const NIGERIA_REGION = {
  latitude: 9.0765,
  longitude: 7.3986,
  latitudeDelta: 6.5,
  longitudeDelta: 6.5,
};

/**
 * Interactive native map for agency report screens. Mirrors the working FRSC
 * native map: a full-screen `MapView` with tappable markers that open a shared
 * report summary. Reports without coordinates (and every report, for
 * completeness) remain reachable and tappable from a list sheet. Web/SSR uses
 * the scrollable fallback in `CitizenReportMap.tsx`.
 */
export function CitizenReportMap({
  title,
  subtitle,
  reports,
  accentColor,
  bottomPadding,
  showAgencyFilter = false,
  detailRouteForReport,
  onReportPress,
}: CitizenReportMapProps) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CitizenIncidentReceipt | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const mapReady = useMemo(() => reports.filter(hasCitizenReportCoordinates), [reports]);

  function pinColor(report: CitizenIncidentReceipt) {
    return showAgencyFilter ? AGENCY_PIN_COLORS[report.suggestedAgency] ?? accentColor : accentColor;
  }

  // Tapping a marker / list row opens the shared summary modal first so the
  // user can confirm the report before navigating away (FRSC behaviour).
  function openSummary(report: CitizenIncidentReceipt) {
    setListOpen(false);
    setSelected(report);
  }

  // Resolve the "View full detail" action: custom handler, then agency route.
  const resolveDetail = (report: CitizenIncidentReceipt): (() => void) | undefined => {
    if (onReportPress) return () => onReportPress(report);
    const route = detailRouteForReport?.(report);
    if (route) return () => router.push(route as any);
    return undefined;
  };

  const selectedViewDetail = selected ? resolveDetail(selected) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={NIGERIA_REGION}>
        {mapReady.map((report) => (
          <Marker
            key={report.reference}
            coordinate={{ latitude: report.latitude!, longitude: report.longitude! }}
            pinColor={pinColor(report)}
            title={report.reference}
            description={getCitizenReportLocationText(report)}
            onPress={() => openSummary(report)}
          />
        ))}
      </MapView>

      {/* Floating header (kept small so it never blocks marker taps) */}
      <View style={[styles.header, { top: insets.top + 8, backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>{subtitle}</Text>
        <Text style={[styles.count, { color: accentColor }]}>
          {mapReady.length} on map · {reports.length} total
        </Text>
      </View>

      {/* Open the full, tappable report list (includes manual / no-GPS reports) */}
      <TouchableOpacity
        style={[styles.listButton, { bottom: bottomPadding, backgroundColor: accentColor }]}
        onPress={() => setListOpen(true)}
        activeOpacity={0.85}
      >
        <Feather name="list" size={16} color="#fff" />
        <Text style={styles.listButtonText}>View all reports ({reports.length})</Text>
      </TouchableOpacity>

      {reports.length === 0 ? (
        <View style={[styles.emptyPill, { top: insets.top + 96, backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="inbox" size={14} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No reports routed here yet.</Text>
        </View>
      ) : null}

      {/* Report list sheet — every report is reachable and tappable here */}
      <Modal visible={listOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setListOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Reports ({reports.length})</Text>
            <TouchableOpacity onPress={() => setListOpen(false)} style={[styles.sheetClose, { backgroundColor: colors.muted }]}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
            <SectionLabel text={`On map · ${mapReady.length}`} color={colors.mutedForeground} />
            {mapReady.map((report) => (
              <ReportLocationCard key={report.reference} report={report} colors={colors} accentColor={pinColor(report)} onPress={() => openSummary(report)} />
            ))}
            {mapReady.length === 0 ? <EmptyRow text="No reports with GPS coordinates." color={colors.mutedForeground} /> : null}

            <SectionLabel text={`Manual location · ${reports.length - mapReady.length}`} color={colors.mutedForeground} />
            {reports.filter((r) => !hasCitizenReportCoordinates(r)).map((report) => (
              <ReportLocationCard key={report.reference} report={report} colors={colors} accentColor="#C8960C" onPress={() => openSummary(report)} />
            ))}
            {reports.length - mapReady.length === 0 ? <EmptyRow text="All reports have GPS coordinates." color={colors.mutedForeground} /> : null}
          </ScrollView>
        </View>
      </Modal>

      <ReportSummaryModal
        report={selected}
        onClose={() => setSelected(null)}
        colors={colors}
        accentColor={accentColor}
        onViewDetail={selectedViewDetail ? () => { setSelected(null); selectedViewDetail(); } : undefined}
      />
    </View>
  );
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.sectionLabel, { color }]}>{text.toUpperCase()}</Text>;
}

function EmptyRow({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.emptyRow, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 15, marginTop: 2 },
  count: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 6 },
  listButton: {
    position: "absolute",
    left: 16,
    right: 16,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  },
  listButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sheetClose: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  emptyRow: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
});
