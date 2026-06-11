import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InspectionReport, useInspections } from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#7B3F00";

function daysUntil(dateStr: string) {
  const d = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(d / 86400000);
}

export default function CertificatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { inspections } = useInspections();
  const [search, setSearch] = useState("");

  const certs = useMemo(() => {
    let r = inspections.filter((i) => i.result !== "fail" && i.certExpiryDate);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((i) =>
        i.plate.toLowerCase().includes(q) ||
        i.certNumber.toLowerCase().includes(q) ||
        i.ownerName.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => {
      const da = daysUntil(a.certExpiryDate!);
      const db = daysUntil(b.certExpiryDate!);
      return da - db;
    });
  }, [inspections, search]);

  function renderItem({ item: r }: { item: InspectionReport }) {
    const days = daysUntil(r.certExpiryDate!);
    const expired = days < 0;
    const expiring = days >= 0 && days <= 30;
    const statusColor = expired ? "#E53935" : expiring ? "#F57C00" : "#388E3C";

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/inspection/${r.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
            <Text style={styles.plateText}>{r.plate}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusChipText, { color: statusColor }]}>
              {expired ? "Expired" : expiring ? `${days}d left` : "Valid"}
            </Text>
          </View>
        </View>
        <Text style={[styles.vehicleText, { color: colors.text }]}>{r.year} {r.color} {r.make} {r.model}</Text>
        <Text style={[styles.ownerText, { color: colors.mutedForeground }]}>{r.ownerName || "Owner not recorded"}</Text>
        <View style={styles.certRow}>
          <Text style={[styles.certNum, { color: PRIMARY }]}>{r.certNumber}</Text>
          <Text style={[styles.expiryText, { color: statusColor }]}>
            {expired
              ? `Expired ${Math.abs(days)}d ago`
              : `Expires ${new Date(r.certExpiryDate!).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`}
          </Text>
        </View>
        {r.result === "conditional" && (
          <View style={[styles.condBadge, { backgroundColor: "#FFF8E1", borderColor: "#FFECB3" }]}>
            <Feather name="alert-circle" size={12} color="#F57C00" />
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#E65100" }}>Conditional — defects must be rectified</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const expiredCount = certs.filter((c) => daysUntil(c.certExpiryDate!) < 0).length;
  const expiringCount = certs.filter((c) => { const d = daysUntil(c.certExpiryDate!); return d >= 0 && d <= 30; }).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY }]}>
        <Text style={styles.headerTitle}>Certificates</Text>
        <Text style={styles.headerSub}>{certs.length} issued · {expiredCount} expired · {expiringCount} expiring</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search} onChangeText={setSearch} placeholder="Search plate, cert number, owner..."
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text }}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>

      {(expiredCount > 0 || expiringCount > 0) && (
        <View style={[styles.alertRow, { backgroundColor: "#FFF3E0", borderColor: "#FFE0B2" }]}>
          <Feather name="alert-triangle" size={14} color="#E65100" />
          <Text style={styles.alertText}>
            {expiredCount > 0 && `${expiredCount} expired`}
            {expiredCount > 0 && expiringCount > 0 && " · "}
            {expiringCount > 0 && `${expiringCount} expiring within 30 days`}
          </Text>
        </View>
      )}

      <FlatList
        data={certs}
        renderItem={renderItem}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="award" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No certificates found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 3 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "transparent", margin: 12, borderRadius: 10, borderWidth: 1 },
  alertText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#E65100" },
  list: { padding: 14, gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  plateBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 1 },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  vehicleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ownerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  certRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  certNum: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  expiryText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  condBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, padding: 8 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
