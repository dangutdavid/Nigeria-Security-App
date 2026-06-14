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
import { useAgency } from "@/context/AgencyContext";
import { useAuth, UserRole, UserStatus } from "@/context/AuthContext";
import { useIncidents } from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";
import { scopeToAgency, usePermissions } from "@/lib/permissions";

const ROLE_LABEL: Record<UserRole, string> = {
  citizen: "Citizen",
  officer: "Officer",
  supervisor: "Supervisor",
  commander: "Commander",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_COLOR: Record<UserRole, string> = {
  citizen: "#6B7A8A",
  officer: "#2C7BE5",
  supervisor: "#C8960C",
  commander: "#1B5E3B",
  admin: "#5C6BC0",
  super_admin: "#7B2CBF",
};

const STATUS_COLOR: Record<UserStatus, string> = {
  active: "#27AE60",
  inactive: "#6B7A8A",
  suspended: "#C0392B",
};

type RoleFilter = "all" | UserRole;

const FILTER_TABS: { label: string; value: RoleFilter }[] = [
  { label: "All", value: "all" },
  { label: "Officers", value: "officer" },
  { label: "Supervisors", value: "supervisor" },
  { label: "Commanders", value: "commander" },
  { label: "Admins", value: "admin" },
];

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, allUsers } = useAuth();
  const { can } = usePermissions();
  const { getAgencyById } = useAgency();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState<"role" | "reports" | "name">("role");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const canManage = can("manage_users", "user");
  const isFrsc = user?.agency === "frsc";
  const agencyColor = (user ? getAgencyById(user.agency)?.primaryColor : undefined) ?? colors.primary;
  const { incidents } = useIncidents();

  // Data tenancy: a user only ever sees officers within their own agency.
  const agencyUsers = useMemo(() => scopeToAgency(user, allUsers), [allUsers, user]);

  const incidentCountByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inc of incidents) {
      if (inc.reportedBy) map[inc.reportedBy] = (map[inc.reportedBy] ?? 0) + 1;
    }
    return map;
  }, [incidents]);

  const filtered = useMemo(() => {
    let list = [...agencyUsers];
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
    if (sortBy === "reports") {
      return list.sort((a, b) => (incidentCountByUser[b.id] ?? 0) - (incidentCountByUser[a.id] ?? 0));
    } else if (sortBy === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return list.sort((a, b) => {
        const order: UserRole[] = ["super_admin", "admin", "commander", "supervisor", "officer", "citizen"];
        return order.indexOf(a.role) - order.indexOf(b.role);
      });
    }
  }, [agencyUsers, roleFilter, search, sortBy, incidentCountByUser]);

  const stats = useMemo(() => {
    const active = agencyUsers.filter((u) => u.status === "active").length;
    const inactive = agencyUsers.filter((u) => u.status !== "active").length;
    const officers = agencyUsers.filter((u) => u.role === "officer").length;
    return { active, inactive, officers, total: agencyUsers.length };
  }, [agencyUsers]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: agencyColor, paddingTop: topPad + 12 },
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
          {isFrsc && <StatChip label="Reports" value={incidents.length} color="#A78BFA" />}
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
                  backgroundColor: active ? agencyColor : colors.card,
                  borderColor: active ? agencyColor : colors.border,
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

      {/* Sort chips */}
      <View style={[styles.sortRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sortLabel, { color: colors.mutedForeground }]}>Sort:</Text>
        {(["role", "reports", "name"] as const).map((key) => {
          const label = key === "role" ? "By Role" : key === "reports" ? "By Reports" : "By Name";
          const active = sortBy === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSortBy(key)}
              style={[styles.sortChip, { backgroundColor: active ? agencyColor + "15" : "transparent", borderColor: active ? agencyColor : colors.border }]}
            >
              <Text style={[styles.sortChipText, { color: active ? agencyColor : colors.mutedForeground }]}>{label}</Text>
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
              </View>
              <Text style={[styles.cardBadge, { color: ROLE_COLOR[item.role] }]}>
                {item.badgeNumber} · {ROLE_LABEL[item.role]}
              </Text>
              <Text
                style={[styles.cardStation, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {item.station}{item.sector ? ` · ${item.sector}` : ""}
              </Text>
              <View style={styles.cardBottomRow}>
                <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[item.status] + "18" }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                  <Text style={[styles.statusChipText, { color: STATUS_COLOR[item.status] }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
                {(incidentCountByUser[item.id] ?? 0) > 0 && (
                  <View style={[styles.incidentBadge, { backgroundColor: agencyColor + "18" }]}>
                    <Feather name="alert-triangle" size={10} color={agencyColor} />
                    <Text style={[styles.incidentBadgeText, { color: agencyColor }]}>
                      {incidentCountByUser[item.id]} report{incidentCountByUser[item.id] !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
              </View>
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
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  sortLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginRight: 2,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 3,
  },
  statusChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardBottomRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 3 },
  incidentBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  incidentBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
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
