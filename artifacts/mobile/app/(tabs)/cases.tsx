import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIncidents, IncidentStatus, SeverityLevel } from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";
import { IncidentCard } from "@/components/IncidentCard";

const STATUS_FILTERS: Array<{ label: string; value: IncidentStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Assigned", value: "assigned" },
  { label: "Review", value: "under_review" },
  { label: "Closed", value: "closed" },
];

const SEVERITY_FILTERS: Array<{ label: string; value: SeverityLevel | "all" }> = [
  { label: "All", value: "all" },
  { label: "Fatal", value: "fatal" },
  { label: "Serious", value: "serious" },
  { label: "Minor", value: "minor" },
];

export default function CasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { incidents } = useIncidents();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | "all">("all");

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSearch =
        !search ||
        inc.title.toLowerCase().includes(search.toLowerCase()) ||
        inc.id.toLowerCase().includes(search.toLowerCase()) ||
        inc.location.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || inc.status === statusFilter;
      const matchSeverity = severityFilter === "all" || inc.severity === severityFilter;
      return matchSearch && matchStatus && matchSeverity;
    });
  }, [incidents, search, statusFilter, severityFilter]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Cases</Text>
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/report")}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchRow,
            { borderColor: colors.border, backgroundColor: colors.muted },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by ID, location, title…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status filters */}
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(i) => i.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    statusFilter === item.value ? colors.primary : colors.muted,
                  borderColor:
                    statusFilter === item.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color:
                      statusFilter === item.value
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Severity filters */}
        <FlatList
          horizontal
          data={SEVERITY_FILTERS}
          keyExtractor={(i) => i.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersRow, { paddingBottom: 10 }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                styles.filterChipSmall,
                {
                  backgroundColor:
                    severityFilter === item.value ? colors.secondary : colors.muted,
                  borderColor:
                    severityFilter === item.value ? colors.secondary : colors.border,
                },
              ]}
              onPress={() => setSeverityFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color:
                      severityFilter === item.value
                        ? "#fff"
                        : colors.mutedForeground,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Count */}
      <View style={[styles.countRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {filtered.length} {filtered.length === 1 ? "case" : "cases"}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          filtered.length === 0 && styles.emptyList,
        ]}
        renderItem={({ item }) => <IncidentCard incident={item} />}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="search" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No cases found
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingTop: 2,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipSmall: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  countRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "center",
  },
});
