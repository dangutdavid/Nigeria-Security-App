import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReferModal } from "@/components/ReferModal";
import { InspectionResult, useInspections } from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";
import { usePermissions } from "@/lib/permissions";

const PRIMARY = "#7B3F00";

const RESULT_COLORS: Record<InspectionResult, string> = {
  pass: "#388E3C",
  fail: "#E53935",
  conditional: "#F57C00",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  pass: "#388E3C",
  fail: "#E53935",
  na: "#9E9E9E",
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getInspection } = useInspections();
  const { can } = usePermissions();
  const [showRefer, setShowRefer] = useState(false);
  const canRefer = can("refer", "inspection");

  const report = getInspection(id ?? "");

  if (!report) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 16, fontFamily: "Inter_400Regular" }}>Inspection not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: PRIMARY, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const failItems = report.items.filter((i) => i.status === "fail");
  const passItems = report.items.filter((i) => i.status === "pass");
  const certDays = report.certExpiryDate ? daysUntil(report.certExpiryDate) : null;
  const certExpired = certDays !== null && certDays < 0;
  const certExpiring = certDays !== null && certDays >= 0 && certDays <= 30;

  const categories = [...new Set(report.items.map((i) => i.category))];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: PRIMARY }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerPlate}>{report.plate}</Text>
          <Text style={styles.headerVehicle}>{report.year} {report.color} {report.make} {report.model}</Text>
        </View>
        <View style={[styles.resultChip, { backgroundColor: RESULT_COLORS[report.result] + "33" }]}>
          <Text style={styles.resultChipText}>{report.result.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Certificate Card */}
        <View style={[styles.certCard, { backgroundColor: report.result === "pass" ? "#E8F5E9" : report.result === "conditional" ? "#FFF8E1" : "#FFEBEE", borderColor: RESULT_COLORS[report.result] + "44" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={[styles.resultIcon, { backgroundColor: RESULT_COLORS[report.result] + "22" }]}>
              <Feather
                name={report.result === "pass" ? "check-circle" : report.result === "conditional" ? "alert-circle" : "x-circle"}
                size={32}
                color={RESULT_COLORS[report.result]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: RESULT_COLORS[report.result] }}>
                {report.result === "pass" ? "ROADWORTHY — Passed" : report.result === "conditional" ? "CONDITIONAL PASS" : "FAILED — Not Roadworthy"}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: RESULT_COLORS[report.result], marginTop: 2 }}>
                {report.certNumber}
              </Text>
            </View>
          </View>
          {report.certExpiryDate && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: certExpired ? "#C62828" : certExpiring ? "#E65100" : "#1B5E20" }}>
                {certExpired
                  ? `⚠ Certificate expired ${Math.abs(certDays!)}d ago`
                  : certExpiring
                  ? `⚠ Expires in ${certDays} days`
                  : `✓ Valid until ${new Date(report.certExpiryDate).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}`}
              </Text>
            </View>
          )}
        </View>

        {/* Summary stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Passed", value: passItems.length, color: "#388E3C" },
            { label: "Failed", value: failItems.length, color: "#E53935" },
            { label: "Total Checks", value: report.items.length, color: colors.text as string },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 4 }} />}
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Vehicle Info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Vehicle & Owner</Text>
          {[
            { label: "Owner", value: report.ownerName || "Not recorded" },
            { label: "Phone", value: report.ownerPhone || "Not recorded" },
            { label: "Category", value: report.vehicleCategory.charAt(0).toUpperCase() + report.vehicleCategory.slice(1) },
            { label: "Engine No.", value: report.engineNumber || "—" },
            { label: "Chassis/VIN", value: report.chassisNumber || "—" },
            { label: "Inspected By", value: report.inspectedByName },
            { label: "Station", value: report.station },
            { label: "Date", value: new Date(report.inspectedAt).toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
          ].map((f) => (
            <View key={f.label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{f.value}</Text>
            </View>
          ))}
        </View>

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
              <Text style={[styles.referSub, { color: colors.mutedForeground }]}>Share this inspection with another agency</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Failed Items Highlighted */}
        {failItems.length > 0 && (
          <View style={[styles.card, { backgroundColor: "#FFEBEE", borderColor: "#FFCDD2" }]}>
            <Text style={[styles.sectionTitle, { color: "#B71C1C" }]}>Defects / Failed Items ({failItems.length})</Text>
            {failItems.map((item) => (
              <View key={item.id} style={[styles.itemRow, { backgroundColor: "#FFCDD244", borderColor: "#FFCDD2" }]}>
                <Feather name="x-circle" size={14} color="#E53935" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#B71C1C" }}>{item.item}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#B71C1C" }}>{item.category}</Text>
                  {item.note && <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#C62828", marginTop: 2 }}>{item.note}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Full Checklist by Category */}
        {categories.map((cat) => {
          const catItems = report.items.filter((i) => i.category === cat);
          return (
            <View key={cat} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{cat}</Text>
              {catItems.map((item) => (
                <View key={item.id} style={[styles.itemRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={[styles.itemStatusDot, { backgroundColor: ITEM_STATUS_COLORS[item.status] + "22", borderColor: ITEM_STATUS_COLORS[item.status] + "44" }]}>
                    <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: ITEM_STATUS_COLORS[item.status] }}>
                      {item.status === "na" ? "N/A" : item.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.text, flex: 1 }}>{item.item}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Notes */}
        {report.defectNotes ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Inspector Notes</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.text, lineHeight: 20 }}>{report.defectNotes}</Text>
          </View>
        ) : null}
      </ScrollView>

      <ReferModal
        visible={showRefer}
        onClose={() => setShowRefer(false)}
        recordType="inspection"
        recordId={report.id}
        snapshot={{
          title: `${report.make} ${report.model} — ${report.result.toUpperCase()}`,
          plate: report.plate,
          severity: report.result,
          location: report.station,
          summary: report.defectNotes || `Roadworthiness inspection result: ${report.result}.`,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  headerPlate: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  headerVehicle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  resultChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  resultChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  content: { padding: 14, gap: 12 },
  certCard: { borderWidth: 1.5, borderRadius: 16, padding: 16 },
  resultIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, gap: 12 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 8, borderWidth: 1, padding: 10 },
  itemStatusDot: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
  referBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  referIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  referTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  referSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
