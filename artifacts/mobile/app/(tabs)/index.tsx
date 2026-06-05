import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";
import { usePatrol } from "@/context/PatrolContext";
import { useAuth } from "@/context/AuthContext";
import { IncidentCard } from "@/components/IncidentCard";

function formatElapsed(startTime: string): string {
  const diff = Math.max(0, Date.now() - new Date(startTime).getTime());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const first = name.split(" ")[0];
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { incidents } = useIncidents();
  const { isOnDuty, activeSession, sessions } = usePatrol();
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  useEffect(() => {
    if (!isOnDuty || !activeSession) { setElapsed(""); return; }
    setElapsed(formatElapsed(activeSession.startTime));
    const id = setInterval(() => setElapsed(formatElapsed(activeSession.startTime)), 1000);
    return () => clearInterval(id);
  }, [isOnDuty, activeSession]);

  const isSupervisor = user?.role === "supervisor";
  const isCommander = user?.role === "commander";

  const todayStr = new Date().toDateString();
  const todayIncs = incidents.filter((inc) => new Date(inc.dateTime).toDateString() === todayStr);
  const todayFatal = todayIncs.filter((inc) => inc.severity === "fatal").length;
  const todayOpen = todayIncs.filter((inc) => inc.status !== "closed").length;
  const myReports = incidents.filter((incident) => incident.reportedBy === user?.id);
  const assignedToMe = useMemo(
    () => incidents.filter((i) => i.assignedTo === user?.id && i.status !== "closed"),
    [incidents, user?.id],
  );
  const isFieldOfficer = user?.role === "field_officer";
  const myDrafts = useMemo(
    () => incidents.filter((i) => i.reportedBy === user?.id && i.status === "draft"),
    [incidents, user?.id],
  );

  const pendingSyncCount = useMemo(() => incidents.filter((i) => i.pendingSync).length, [incidents]);
  const oldestOpenCase = useMemo(() => {
    const open = incidents.filter((i) => i.status !== "closed" && i.status !== "draft");
    if (open.length === 0) return null;
    const oldest = open.reduce((a, b) => new Date(a.dateTime) < new Date(b.dateTime) ? a : b);
    const diffDays = Math.floor((Date.now() - new Date(oldest.dateTime).getTime()) / 86400000);
    return diffDays >= 3 ? { days: diffDays, id: oldest.id } : null;
  }, [incidents]);
  const weekSessionCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return sessions.filter((s) => s.officerId === user?.id && new Date(s.startTime).getTime() >= weekAgo).length;
  }, [sessions, user?.id]);
  const unassignedCount = incidents.filter((i) => i.status === "submitted").length;
  const fatalOpenCount = incidents.filter((i) => i.severity === "fatal" && i.status !== "closed").length;

  const sparkline = useMemo(() => {
    const result: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const s = d.toDateString();
      result.push(incidents.filter((inc) => new Date(inc.dateTime).toDateString() === s).length);
    }
    return result;
  }, [incidents]);
  const recent = incidents.slice(0, 5);
  const openCount = incidents.filter((incident) => incident.status !== "closed").length;
  const fatalCount = incidents.filter((incident) => incident.severity === "fatal" && incident.status !== "closed").length;
  const severityFilters = [
    { key: "fatal", label: "Fatal", value: incidents.filter((incident) => incident.severity === "fatal").length, color: "#8B0000" },
    { key: "serious", label: "Serious", value: incidents.filter((incident) => incident.severity === "serious").length, color: "#E67E22" },
    { key: "minor", label: "Minor", value: incidents.filter((incident) => incident.severity === "minor").length, color: "#27AE60" },
  ];
  const statusFilters = [
    { key: "submitted", label: "Submitted", value: incidents.filter((incident) => incident.status === "submitted").length, color: colors.primary },
    { key: "assigned", label: "Assigned", value: incidents.filter((incident) => incident.status === "assigned").length, color: colors.secondary },
    { key: "under_review", label: "Review", value: incidents.filter((incident) => incident.status === "under_review").length, color: colors.warning },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.kicker}>FRSC Field Operations</Text>
              <Text style={styles.heroTitle}>{user ? greeting(user.name) : "Dashboard"}</Text>
              <Text style={styles.heroSub}>Offline-first incident tracking and rapid reporting</Text>
            </View>
            <TouchableOpacity style={styles.heroBadge} onPress={() => router.push("/patrol-log")}>
              <Feather name={isOnDuty ? "check-circle" : "shield"} size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.dutyPill} onPress={() => router.push("/patrol-log")}>
            <View style={[styles.dutyDot, { backgroundColor: isOnDuty ? colors.success : colors.warning }]} />
            <View style={styles.dutyTextWrap}>
              <Text style={[styles.dutyText, { color: isOnDuty ? "#fff" : "#163A2A" }]}>
                {isOnDuty ? "On duty" : "Start duty"}
              </Text>
              <Text style={[styles.dutySub, { color: isOnDuty ? "rgba(255,255,255,0.85)" : "#163A2A" }]}>
                {isOnDuty && elapsed
                  ? `${activeSession?.route ?? "Patrol"} · ${elapsed}`
                  : activeSession
                    ? activeSession.route
                    : "Tap to start duty"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={isOnDuty ? "#fff" : "#163A2A"} />
          </TouchableOpacity>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{openCount}</Text>
              <Text style={styles.statLabel}>Open cases</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{fatalCount}</Text>
              <Text style={styles.statLabel}>Critical</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{myReports.length}</Text>
              <Text style={styles.statLabel}>My reports</Text>
            </View>
            {isFieldOfficer && assignedToMe.length > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{assignedToMe.length}</Text>
                <Text style={styles.statLabel}>Assigned</Text>
              </View>
            )}
            {weekSessionCount > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{weekSessionCount}</Text>
                <Text style={styles.statLabel}>Patrols 7d</Text>
              </View>
            )}
          </View>

          {sparkline.some((v) => v > 0) && (
            <View style={styles.sparkRow}>
              {sparkline.map((count, idx) => {
                const maxSpark = Math.max(...sparkline, 1);
                const barH = Math.max(Math.round((count / maxSpark) * 22), count > 0 ? 4 : 1);
                const isToday = idx === 6;
                return (
                  <View key={idx} style={styles.sparkCol}>
                    <View
                      style={[
                        styles.sparkBar,
                        {
                          height: barH,
                          backgroundColor: isToday ? "#fff" : "rgba(255,255,255,0.45)",
                        },
                      ]}
                    />
                  </View>
                );
              })}
              <Text style={styles.sparkLabel}>7-day trend</Text>
            </View>
          )}
        </View>

        {pendingSyncCount > 0 && (
          <View style={[styles.syncBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning + "40" }]}>
            <Feather name="cloud-off" size={15} color={colors.warning} />
            <Text style={[styles.syncBannerText, { color: colors.warning }]}>
              {pendingSyncCount} incident{pendingSyncCount !== 1 ? "s" : ""} pending sync — will upload when connected
            </Text>
          </View>
        )}

        {(isSupervisor || isCommander) && (unassignedCount > 0 || fatalOpenCount > 0) && (
          <View style={[styles.urgentBanner, { backgroundColor: colors.fatal + "0E", borderColor: colors.fatal + "30" }]}>
            <View style={[styles.urgentIcon, { backgroundColor: colors.fatal + "1A" }]}>
              <Feather name="alert-octagon" size={18} color={colors.fatal} />
            </View>
            <View style={styles.urgentBody}>
              <Text style={[styles.urgentTitle, { color: colors.fatal }]}>Action required</Text>
              <Text style={[styles.urgentSub, { color: colors.mutedForeground }]}>
                {[
                  unassignedCount > 0 && `${unassignedCount} unassigned case${unassignedCount > 1 ? "s" : ""}`,
                  fatalOpenCount > 0 && `${fatalOpenCount} fatal open`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.urgentBtn, { backgroundColor: colors.fatal }]}
              onPress={() => router.push({ pathname: "/(tabs)/cases", params: { status: "submitted" } } as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.urgentBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {isFieldOfficer && myDrafts.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/(tabs)/cases", params: { status: "draft" } } as any)}
            style={[styles.urgentBanner, { backgroundColor: colors.warning + "0E", borderColor: colors.warning + "30" }]}
          >
            <View style={[styles.urgentIcon, { backgroundColor: colors.warning + "1A" }]}>
              <Feather name="edit-3" size={18} color={colors.warning} />
            </View>
            <View style={styles.urgentBody}>
              <Text style={[styles.urgentTitle, { color: colors.warning }]}>Unsent drafts</Text>
              <Text style={[styles.urgentSub, { color: colors.mutedForeground }]}>
                {myDrafts.length} report{myDrafts.length > 1 ? "s" : ""} saved but not submitted
              </Text>
            </View>
            <View style={[styles.urgentBtn, { backgroundColor: colors.warning }]}>
              <Text style={styles.urgentBtnText}>View</Text>
            </View>
          </TouchableOpacity>
        )}

        {(isSupervisor || isCommander) && oldestOpenCase && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/case/[id]", params: { id: oldestOpenCase.id } } as any)}
            style={[styles.urgentBanner, { backgroundColor: "#7C3AED0E", borderColor: "#7C3AED30" }]}
          >
            <View style={[styles.urgentIcon, { backgroundColor: "#7C3AED1A" }]}>
              <Feather name="clock" size={18} color="#7C3AED" />
            </View>
            <View style={styles.urgentBody}>
              <Text style={[styles.urgentTitle, { color: "#7C3AED" }]}>Stale case</Text>
              <Text style={[styles.urgentSub, { color: colors.mutedForeground }]}>
                Oldest open case is {oldestOpenCase.days}d old — needs attention
              </Text>
            </View>
            <View style={[styles.urgentBtn, { backgroundColor: "#7C3AED" }]}>
              <Text style={styles.urgentBtnText}>View</Text>
            </View>
          </TouchableOpacity>
        )}

        {isFieldOfficer && assignedToMe.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ASSIGNED TO ME</Text>
                <View style={[styles.assignedBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.assignedBadgeText}>{assignedToMe.length}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases" as any)}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text>
              </TouchableOpacity>
            </View>
            {assignedToMe.slice(0, 3).map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
            {assignedToMe.length > 3 && (
              <TouchableOpacity
                style={[styles.showMoreBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push("/(tabs)/cases" as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.showMoreText, { color: colors.primary }]}>
                  +{assignedToMe.length - 3} more assigned cases
                </Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {isFieldOfficer && myDrafts.length > 0 && (
          <View style={[styles.urgentBanner, { backgroundColor: colors.warning + "10", borderColor: colors.warning + "40" }]}>
            <View style={[styles.urgentIcon, { backgroundColor: colors.warning + "1A" }]}>
              <Feather name="cloud-off" size={18} color={colors.warning} />
            </View>
            <View style={styles.urgentBody}>
              <Text style={[styles.urgentTitle, { color: colors.warning }]}>
                {myDrafts.length} unsent draft{myDrafts.length > 1 ? "s" : ""}
              </Text>
              <Text style={[styles.urgentSub, { color: colors.mutedForeground }]}>
                Complete and submit to sync
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.urgentBtn, { backgroundColor: colors.warning }]}
              onPress={() => router.push("/(tabs)/cases?status=draft" as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.urgentBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>TODAY</Text>
            {todayIncs.length > 0 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases" as any)}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          {todayIncs.length === 0 ? (
            <TouchableOpacity
              style={[styles.todayCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/report" as any)}
              activeOpacity={0.85}
            >
              <View style={styles.todayLeft}>
                <View style={[styles.todayPill, { backgroundColor: colors.muted }]}>
                  <Feather name="check" size={14} color={colors.mutedForeground} />
                </View>
                <View>
                  <Text style={[styles.todayBigLabel, { color: colors.text }]}>No incidents today</Text>
                  <Text style={[styles.todayBigSub, { color: colors.mutedForeground }]}>Tap to file a new report</Text>
                </View>
              </View>
              <Feather name="plus-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.todayCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/cases" as any)}
              activeOpacity={0.85}
            >
              <View style={styles.todayLeft}>
                <Text style={[styles.todayBigNum, { color: colors.text }]}>{todayIncs.length}</Text>
                <View>
                  <Text style={[styles.todayBigLabel, { color: colors.text }]}>
                    incident{todayIncs.length > 1 ? "s" : ""} today
                  </Text>
                  <Text style={[styles.todayBigSub, { color: colors.mutedForeground }]}>
                    {todayOpen} open · {todayIncs.length - todayOpen} closed · {todayIncs.reduce((s, i) => s + i.victims.length, 0)} victims
                  </Text>
                </View>
              </View>
              <View style={styles.todayRight}>
                {todayFatal > 0 && (
                  <View style={[styles.todayPill, { backgroundColor: colors.fatalLight }]}>
                    <Feather name="alert-triangle" size={10} color={colors.fatal} />
                    <Text style={[styles.todayPillText, { color: colors.fatal }]}>{todayFatal} fatal</Text>
                  </View>
                )}
                {todayOpen > 0 && (
                  <View style={[styles.todayPill, { backgroundColor: colors.warningLight }]}>
                    <Feather name="clock" size={10} color={colors.warning} />
                    <Text style={[styles.todayPillText, { color: colors.warning }]}>{todayOpen} open</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          )}
          {todayIncs.length > 0 && (() => {
            const typeMap: Record<string, { icon: string; color: string }> = {
              crash: { icon: "alert-triangle", color: "#C0392B" },
              breakdown: { icon: "tool", color: "#E67E22" },
              hazard: { icon: "alert-circle", color: "#C8960C" },
              flooding: { icon: "droplet", color: "#2C7BE5" },
            };
            const counts = Object.entries(
              todayIncs.reduce<Record<string, number>>((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {})
            ).filter(([, c]) => c > 0);
            if (counts.length < 2) return null;
            return (
              <View style={styles.todayTypeRow}>
                {counts.map(([type, count]) => (
                  <View key={type} style={[styles.todayTypeChip, { backgroundColor: (typeMap[type]?.color ?? colors.mutedForeground) + "12", borderColor: (typeMap[type]?.color ?? colors.mutedForeground) + "30" }]}>
                    <Feather name={(typeMap[type]?.icon ?? "circle") as any} size={10} color={typeMap[type]?.color ?? colors.mutedForeground} />
                    <Text style={[styles.todayTypeText, { color: typeMap[type]?.color ?? colors.mutedForeground }]}>{count} {type}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>THIS MONTH</Text>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>Tap to open cases</Text>
          </View>
          <View style={styles.monthGrid}>
            <TouchableOpacity
              style={[
                styles.monthCardLarge,
                {
                  backgroundColor: colors.secondary + "10",
                  borderColor: colors.secondary + "55",
                },
              ]}
              onPress={() => router.push("/report")}
              activeOpacity={0.85}
            >
              <View style={styles.monthCardHeader}>
                <View style={[styles.monthIconLarge, { backgroundColor: colors.secondary + "20" }]}>
                  <Feather name="plus" size={22} color={colors.secondary} />
                </View>
                <Text style={[styles.monthValueLarge, { color: colors.text }]}>{incidents.length}</Text>
              </View>
              <Text style={[styles.monthLabelLarge, { color: colors.secondary }]}>Add incident</Text>
            </TouchableOpacity>

            <View style={styles.monthSplitRow}>
              <TouchableOpacity
                style={[styles.monthCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/cases?severity=fatal" as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.monthIconSmall, { backgroundColor: colors.fatalLight }]}>
                  <Feather name="alert-triangle" size={18} color={colors.fatal} />
                </View>
                <View style={styles.monthCopy}>
                  <Text style={[styles.monthValueSmall, { color: colors.text }]}>{fatalCount}</Text>
                  <Text style={[styles.monthLabelSmall, { color: colors.mutedForeground }]}>Fatal Crashes</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.monthCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/cases?status=closed" as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.monthIconSmall, { backgroundColor: colors.successLight }]}>
                  <Feather name="check-circle" size={18} color={colors.success} />
                </View>
                <View style={styles.monthCopy}>
                  <Text style={[styles.monthValueSmall, { color: colors.text }]}>{incidents.filter((incident) => incident.status === "closed").length}</Text>
                  <Text style={[styles.monthLabelSmall, { color: colors.mutedForeground }]}>Closed Cases</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.monthCardWide, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/cases?status=under_review" as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.monthIconSmall, { backgroundColor: colors.warningLight }]}>
                <Feather name="clock" size={18} color={colors.warning} />
              </View>
              <View style={styles.monthCopy}>
                <Text style={[styles.monthValueSmall, { color: colors.text }]}>
                  {incidents.filter((incident) => incident.status === "submitted" || incident.status === "under_review").length}
                </Text>
                <Text style={[styles.monthLabelSmall, { color: colors.mutedForeground }]}>Pending Review</Text>
              </View>
            </TouchableOpacity>

            {(() => {
              const totalVictims = incidents.reduce((s, i) => s + i.victims.length, 0);
              if (totalVictims === 0) return null;
              const fatalV = incidents.reduce((s, i) => s + i.victims.filter((v) => v.condition === "fatal").length, 0);
              return (
                <TouchableOpacity
                  style={[styles.monthCardWide, { backgroundColor: colors.fatalLight, borderColor: colors.fatal + "30" }]}
                  onPress={() => router.push("/analytics" as any)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.monthIconSmall, { backgroundColor: colors.fatalLight }]}>
                    <Feather name="users" size={18} color={colors.fatal} />
                  </View>
                  <View style={styles.monthCopy}>
                    <Text style={[styles.monthValueSmall, { color: colors.fatal }]}>{totalVictims}</Text>
                    <Text style={[styles.monthLabelSmall, { color: colors.fatal + "BB" }]}>Victims{fatalV > 0 ? ` · ${fatalV} fatal` : ""}</Text>
                  </View>
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK FILTERS</Text>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>Tap to open cases</Text>
          </View>
          <View style={styles.filterChipRow}>
            {severityFilters.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, { borderColor: item.color, backgroundColor: colors.card }]}
                onPress={() => router.push(`/(tabs)/cases?severity=${item.key}` as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.filterDot, { backgroundColor: item.color }]} />
                <Text style={[styles.filterChipText, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.filterChipCount, { color: colors.mutedForeground }]}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.statusPillsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {statusFilters.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.statusPillRow}
                onPress={() => router.push(`/(tabs)/cases?status=${item.key}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.statusLabel, { color: colors.text }]}>{item.label}</Text>
                </View>
                <Text style={[styles.statusValue, { color: colors.mutedForeground }]}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/(tabs)/cases")}>
            <Feather name="list" size={18} color={colors.text} />
            <Text style={[styles.quickActionAltText, { color: colors.text }]}>View cases</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.secondary }]} onPress={() => router.push("/report")}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Add incident</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.primary, backgroundColor: colors.primary + "14" }]} onPress={() => router.push("/analytics")}>
            <Feather name="bar-chart-2" size={18} color={colors.primary} />
            <Text style={[styles.quickActionAltText, { color: colors.primary }]}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/patrol-log")}>
            <Feather name="anchor" size={18} color={colors.text} />
            <Text style={[styles.quickActionAltText, { color: colors.text }]}>Patrol Log</Text>
          </TouchableOpacity>
        </View>

        {isFieldOfficer && (
          <View style={styles.quickRow}>
            <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/vehicle-lookup" as any)}>
              <Feather name="truck" size={18} color={colors.text} />
              <Text style={[styles.quickActionAltText, { color: colors.text }]}>Vehicle Lookup</Text>
            </TouchableOpacity>
          </View>
        )}

        {(isSupervisor || isCommander) && (
          <View style={styles.quickRow}>
            <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/users" as any)}>
              <Feather name="users" size={18} color={colors.text} />
              <Text style={[styles.quickActionAltText, { color: colors.text }]}>Manage Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickActionAlt, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/vehicle-lookup" as any)}>
              <Feather name="truck" size={18} color={colors.text} />
              <Text style={[styles.quickActionAltText, { color: colors.text }]}>Vehicle Lookup</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/analytics")}
            activeOpacity={0.85}
          >
            <View style={[styles.analyticsIcon, { backgroundColor: colors.primary + "14" }]}>
              <Feather name="bar-chart-2" size={18} color={colors.primary} />
            </View>
            <View style={styles.analyticsCopy}>
              <Text style={[styles.analyticsTitle, { color: colors.text }]}>Analytics & Hotspots</Text>
              <Text style={[styles.analyticsSub, { color: colors.mutedForeground }]}>
                View trends, crash patterns, and operational insights
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {myReports.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MY RECENT REPORTS</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>All cases</Text>
              </TouchableOpacity>
            </View>
            {myReports.slice(0, 3).map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
            {myReports.length > 3 && (
              <TouchableOpacity
                style={[styles.showMoreBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push("/(tabs)/cases" as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.showMoreText, { color: colors.primary }]}>
                  +{myReports.length - 3} more reports
                </Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT INCIDENTS</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary, bottom: insets.bottom + 108 }]}
        onPress={() => router.push("/report")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  hero: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  kicker: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 18 },
  heroBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  dutyPill: { marginTop: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.14)", flexDirection: "row", alignItems: "center", gap: 10 },
  dutyDot: { width: 10, height: 10, borderRadius: 5 },
  dutyTextWrap: { flex: 1 },
  dutyText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  dutySub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  quickAction: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  quickActionText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  quickActionAlt: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1 },
  quickActionAltText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  analyticsCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  analyticsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  analyticsCopy: { flex: 1 },
  analyticsTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  analyticsSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  section: { marginTop: 14 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionLink: { fontSize: 11, fontFamily: "Inter_500Medium" },
  monthGrid: { gap: 10 },
  monthCardLarge: { borderWidth: 1, borderRadius: 20, padding: 16 },
  monthCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthIconLarge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  monthValueLarge: { fontSize: 30, fontFamily: "Inter_700Bold" },
  monthLabelLarge: { marginTop: 12, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  monthSplitRow: { flexDirection: "row", gap: 10 },
  monthCardSmall: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  monthCardWide: { borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  monthIconSmall: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  monthCopy: { flex: 1 },
  monthValueSmall: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 20 },
  monthLabelSmall: { marginTop: 2, fontSize: 11, fontFamily: "Inter_500Medium" },
  filterChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  filterChipCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusPillsCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" },
  statusPillRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sparkRow: { flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 14, height: 28 },
  sparkCol: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sparkBar: { width: "100%", borderRadius: 2 },
  sparkLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_500Medium", marginLeft: 8, alignSelf: "center" },
  syncBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginTop: 12, marginHorizontal: 14 },
  syncBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  urgentBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 14 },
  urgentIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  urgentBody: { flex: 1 },
  urgentTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  urgentSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  urgentBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  urgentBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  todayCard: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  todayLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  todayRight: { gap: 6, alignItems: "flex-end" },
  todayBigNum: { fontSize: 36, fontFamily: "Inter_700Bold", lineHeight: 38 },
  todayBigLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  todayBigSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  todayPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  todayPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  todayTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  todayTypeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  todayTypeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  assignedBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  assignedBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  showMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12, marginTop: 6 },
  showMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(0,0,0,0.18)" },
});