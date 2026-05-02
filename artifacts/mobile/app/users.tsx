import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, UserRole, UserStatus } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const ROLE_LABEL: Record<UserRole, string> = {
  field_officer: "Field Officer",
  supervisor: "Supervisor",
  commander: "Commander",
};

const ROLE_COLOR: Record<UserRole, string> = {
  field_officer: "#2C7BE5",
  supervisor: "#C8960C",
  commander: "#1B5E3B",
};

const STATUS_COLOR: Record<UserStatus, string> = {
  active: "#27AE60",
  inactive: "#6B7A8A",
  suspended: "#C0392B",
};

type RoleFilter = "all" | UserRole;

const FILTER_TABS: { label: string; value: RoleFilter }[] = [
  { label: "All", value: "all" },
  { label: "Officers", value: "field_officer" },
  { label: "Supervisors", value: "supervisor" },
  { label: "Commanders", value: "commander" },
];

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, allUsers } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const isCommander = user?.role === "commander";
  const isSupervisor = user?.role === "supervisor";
  const canManage = isCommander || isSupervisor;

  const filtered = useMemo(() => {
    let list = [...allUsers];
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.badgeNumber.toLowerCase().includes(q) ||
          u.station.toLowerCase().includes(q) ||
          u.sector.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const order: UserRole[] = ["commander", "supervisor", "field_officer"];
      return order.indexOf(a.role) - order.indexOf(b.role);
    });
  }, [allUsers, roleFilter, search]);

  const stats = useMemo(() => {
    const active = allUsers.filter((u) => u.status === "active").length;
    const inactive = allUsers.filter((u) => u.status !== "active").length;
    const officers = allUsers.filter((u) => u.role === "field_officer").length;
    return { active, inactive, officers, total: allUsers.length };
  }, [allUsers]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primary, paddingTop: topPad + 12 },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Management</Text>
          {canManage ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/user-form");
              }}
              style={[styles.addBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
            >
              <Feather name="user-plus" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatChip label="Total" value={stats.total} />
          <StatChip label="Active" value={stats.active} color="#6EE39B" />
          <StatChip label="Inactive" value={stats.inactive} color="#FFC97A" />
          <StatChip label="Officers" value={stats.officers} />
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name, badge, station…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Role filter chips */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => {
          const active = roleFilter === tab.value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => setRoleFilter(tab.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? "#fff" : colors.mutedForeground },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottomPad, paddingTop: 8 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No users found
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/user-form?id=${item.id}`);
            }}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {/* Left: avatar */}
            <View
              style={[
                styles.avatar,
                { backgroundColor: ROLE_COLOR[item.role] + "18" },
              ]}
            >
              <Text style={[styles.avatarText, { color: ROLE_COLOR[item.role] }]}>
                {item.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </Text>
            </View>

            {/* Middle: info */}
            <View style={styles.cardInfo}>
              <View style={styles.cardTopRow}>
                <Text
                  style={[styles.cardName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: STATUS_COLOR[item.status] },
                  ]}
                />
              </View>
              <Text style={[styles.cardBadge, { color: ROLE_COLOR[item.role] }]}>
                {item.badgeNumber} · {ROLE_LABEL[item.role]}
              </Text>
              <Text
                style={[styles.cardStation, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {item.station}
              </Text>
            </View>

            {/* Right: chevron */}
            {canManage && (
              <Feather name="chevron-right" size={18} color={colors.border} />
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={statStyles.chip}>
      <Text style={[statStyles.value, color ? { color } : {}]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: {
    alignItems: "center",
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardBadge: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  cardStation: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
