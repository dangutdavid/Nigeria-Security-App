import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AGENCY_MODULE_BLUEPRINTS,
  AuditStatus,
  COMMON_PLATFORM_CAPABILITIES,
  MVP_AUDIT_CHECKLIST,
} from "@/data/mvpAuditBlueprint";
import { useColors } from "@/hooks/useColors";

const STATUS_META: Record<AuditStatus, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  implemented: { label: "Implemented", color: "#15803D", icon: "check-circle" },
  partial: { label: "Partially Implemented", color: "#B45309", icon: "alert-circle" },
  not_implemented: { label: "Not Implemented", color: "#B91C1C", icon: "x-circle" },
  future_phase: { label: "Future Phase", color: "#475569", icon: "clock" },
};

function StatusPill({ status }: { status: AuditStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.color + "18" }]}> 
      <Feather name={meta.icon} size={12} color={meta.color} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

export default function AuditBlueprintScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const implemented = MVP_AUDIT_CHECKLIST.filter((item) => item.status === "implemented").length;
  const partial = MVP_AUDIT_CHECKLIST.filter((item) => item.status === "partial").length;
  const future = MVP_AUDIT_CHECKLIST.filter((item) => item.status === "future_phase").length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: "#0A1628" }]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MVP Audit & Agency Blueprint</Text>
        <Text style={styles.headerSub}>Generated review baseline · 11 June 2026</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.summaryValue, { color: "#15803D" }]}>{implemented}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Implemented</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.summaryValue, { color: "#B45309" }]}>{partial}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Partial</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.summaryValue, { color: "#475569" }]}>{future}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Future</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Shared case-management engine</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Configuration-first capabilities that every tenant should reuse rather than rebuilding per agency.</Text>
          <View style={styles.capabilityGrid}>
            {COMMON_PLATFORM_CAPABILITIES.map((capability) => (
              <View key={capability} style={[styles.capabilityChip, { backgroundColor: colors.muted }]}> 
                <Feather name="check" size={12} color={colors.primary} />
                <Text style={[styles.capabilityText, { color: colors.text }]}>{capability}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.listTitle, { color: colors.text }]}>Implementation audit checklist</Text>
        {MVP_AUDIT_CHECKLIST.map((item) => (
          <View key={item.id} style={[styles.auditCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.auditHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.auditTitle, { color: colors.text }]}>{item.title}</Text>
                {item.priority ? <Text style={[styles.priority, { color: colors.mutedForeground }]}>{item.priority}</Text> : null}
              </View>
              <StatusPill status={item.status} />
            </View>
            <Text style={[styles.auditDescription, { color: colors.mutedForeground }]}>{item.description}</Text>
            <View style={[styles.evidenceBox, { backgroundColor: colors.muted }]}> 
              <Text style={[styles.evidenceLabel, { color: colors.mutedForeground }]}>Evidence / gap</Text>
              <Text style={[styles.evidenceText, { color: colors.text }]}>{item.evidence}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.listTitle, { color: colors.text }]}>Agency module blueprint</Text>
        {AGENCY_MODULE_BLUEPRINTS.map((agency) => (
          <View key={agency.id} style={[styles.agencyCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.agencyHeader}>
              <View style={[styles.agencyIcon, { backgroundColor: agency.primaryColor + "1A" }]}> 
                <Feather name={agency.icon as keyof typeof Feather.glyphMap} size={18} color={agency.primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.agencyShort, { color: colors.text }]}>{agency.shortName}</Text>
                <Text style={[styles.agencyFull, { color: colors.mutedForeground }]}>{agency.fullName}</Text>
              </View>
              <View style={[styles.statePill, { backgroundColor: agency.implementationState === "live_mvp" ? "#15803D18" : "#47556918" }]}> 
                <Text style={[styles.stateText, { color: agency.implementationState === "live_mvp" ? "#15803D" : "#475569" }]}> 
                  {agency.implementationState === "live_mvp" ? "Live MVP" : "Blueprint"}
                </Text>
              </View>
            </View>

            <View style={styles.columnBlock}>
              <Text style={[styles.blockTitle, { color: colors.text }]}>Agency-specific modules</Text>
              {agency.agencyModules.map((module) => (
                <Text key={module} style={[styles.bullet, { color: colors.mutedForeground }]}>• {module}</Text>
              ))}
            </View>

            <View style={styles.columnBlock}>
              <Text style={[styles.blockTitle, { color: colors.text }]}>Routing rules</Text>
              {agency.routingRules.map((rule) => (
                <Text key={rule} style={[styles.bullet, { color: colors.mutedForeground }]}>• {rule}</Text>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  backText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  content: { padding: 16, gap: 14 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: "center" },
  summaryValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 19 },
  capabilityGrid: { gap: 8, marginTop: 14 },
  capabilityChip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  capabilityText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  listTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 6 },
  auditCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  auditHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  auditTitle: { fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 20 },
  priority: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 3 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  auditDescription: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  evidenceBox: { borderRadius: 12, padding: 12, gap: 3 },
  evidenceLabel: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  evidenceText: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  agencyCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  agencyHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  agencyIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  agencyShort: { fontSize: 16, fontFamily: "Inter_700Bold" },
  agencyFull: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  stateText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  columnBlock: { gap: 5 },
  blockTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bullet: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
