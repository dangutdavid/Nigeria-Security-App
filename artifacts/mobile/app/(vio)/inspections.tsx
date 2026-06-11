import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InspectionReport, InspectionResult, useInspections } from "@/context/InspectionContext";
import { useColors } from "@/hooks/useColors";

const PRIMARY = "#7B3F00";

const RESULT_COLORS: Record<InspectionResult, string> = {
  pass: "#388E3C",
  fail: "#E53935",
  conditional: "#F57C00",
};

const FILTER_TABS: { id: InspectionResult | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pass", label: "Passed" },
  { id: "fail", label: "Failed" },
  { id: "conditional", label: "Conditional" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InspectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { inspections } = useInspections();
  const [filter, setFilter] = useState<InspectionResult | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let r = inspections;
    if (filter !== "all") r = r.filter((i) => i.result === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((i) =>
        i.plate.toLowerCase().includes(q) ||
        i.make.toLowerCase().includes(q) ||
        i.ownerName.toLowerCase().includes(q) ||
        i.certNumber.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime());
  }, [inspections, filter, search]);

  function renderItem({ item: r }: { item: InspectionReport }) {
    const failCount = r.items.filter((i) => i.status === "fail").length;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/inspection/${r.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={[styles.resultBar, { backgroundColor: RESULT_COLORS[r.result] }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.plateBadge, { backgroundColor: "#FFF8DC", borderColor: "#DAA520" }]}>
              <Text style={styles.plateText}>{r.plate}</Text>
            </View>
            <View style={[styles.resultChip, { backgroundColor: RESULT_COLORS[r.result] + "22" }]}>
              <Text style={[styles.resultChipText, { color: RESULT_COLORS[r.result] }]}>
                {r.result.charAt(0).toUpperCase() + r.result.slice(1)}
              </Text>
            </View>
            <Text style={[styles.cardTime, { color: colors.mutedForeground, marginLeft: "auto" }]}>{timeAgo(r.inspectedAt)}</Text>
          </View>
          <Text style={[styles.vehicleDesc, { color: colors.text }]}>{r.year} {r.color} {r.make} {r.model}</Text>
          <Text style={[styles.ownerText, { color: colors.mutedForeground }]}>{r.ownerName} · {r.vehicleCategory}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={[styles.certNum, { color: PRIMARY }]}>{r.certNumber}</Text>
            {failCount > 0 && (
              <Text style={[styles.failCount, { color: "#E53935" }]}>{failCount} defect{failCount !== 1 ? "s" : ""}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: PRIMARY }]}>
        <Text style={styles.headerTitle}>Inspections</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(vio)/new-inspection" as any)}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search} onChangeText={setSearch} placeholder="Search plate, owner, cert number..."
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text }}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabsScroll, { borderBottomColor: colors.border }]} contentContainerStyle={styles.tabs}>
        {FILTER_TABS.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setFilter(t.id)}
            style={[styles.tab, filter === t.id && { borderBottomWidth: 2, borderBottomColor: PRIMARY }]}>
            <Text style={[styles.tabText, { color: filter === t.id ? PRIMARY : colors.mutedForeground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="clipboard" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No inspections found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  tabsScroll: { borderBottomWidth: 1, flexGrow: 0 },
  tabs: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { padding: 14, gap: 10 },
  card: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, overflow: "hidden" },
  resultBar: { width: 4, borderRadius: 4, alignSelf: "stretch", flexShrink: 0 },
  plateBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  plateText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#5C3D00", letterSpacing: 1 },
  resultChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  resultChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  vehicleDesc: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ownerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  certNum: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  failCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
