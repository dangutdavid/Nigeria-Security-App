import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { CitizenReportMap } from "@/components/CitizenReportMap";
import { NotificationAccessCard } from "@/components/NotificationAccessCard";
import { useAgency } from "@/context/AgencyContext";
import { routeForUser, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { roleLabel } from "@/lib/permissions";
import {
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  formatCitizenIncidentStatus,
  seedCitizenReportsForAgencyMock,
} from "@/services/citizenIncidentApi";
import { listReports, updateReportStatus } from "@/services/reportRepository";

const BUILT_IN_AGENCIES = new Set(["frsc", "police", "vio", "civil_defence", "admin"]);
const STATUS_FLOW: Record<CitizenIncidentStatus, CitizenIncidentStatus | null> = {
  submitted: "triaged",
  triaged: "assigned",
  assigned: "in_progress",
  in_progress: "resolved",
  resolved: "closed",
  closed: null,
};
type WorkspaceSection = "overview" | "reports" | "map" | "tools";

const WORKSPACE_SECTIONS: Array<{ id: WorkspaceSection; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { id: "overview", label: "Home", icon: "grid" },
  { id: "reports", label: "Reports", icon: "file-text" },
  { id: "map", label: "Map", icon: "map" },
  { id: "tools", label: "Tools", icon: "user" },
];

export default function AgencyWorkspaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const { getAgencyById } = useAgency();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const agency = user ? getAgencyById(user.agency) : undefined;

  const load = useCallback(async () => {
    if (!user) return;
    const allReports = await listReports();
    const agencyReports = allReports.filter((report) => report.suggestedAgency === user.agency);
    if (agencyReports.length === 0 && agency && !BUILT_IN_AGENCIES.has(user.agency)) {
      const seeded = await seedCitizenReportsForAgencyMock(agency, user.name);
      setReports(seeded);
      return;
    }
    setReports(agencyReports);
  }, [agency, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accent = agency?.primaryColor ?? "#344054";
  const metrics = useMemo(() => ({
    total: reports.length,
    newWork: reports.filter((report) => report.status === "submitted" || report.status === "triaged").length,
    active: reports.filter((report) => report.status === "assigned" || report.status === "in_progress").length,
    resolved: reports.filter((report) => report.status === "resolved" || report.status === "closed").length,
    high: reports.filter((report) => report.emergencyLevel === "high" || report.emergencyLevel === "critical").length,
  }), [reports]);
  const recentReports = useMemo(() => reports.slice(0, 3), [reports]);

  if (isLoading) return null;
  if (!user) return <Redirect href="/" />;
  if (BUILT_IN_AGENCIES.has(user.agency)) return <Redirect href={routeForUser(user) as any} />;

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function signOut() {
    await logout();
    router.replace("/");
  }

  async function advanceStatus(report: CitizenIncidentReceipt) {
    if (!user) return;
    const nextStatus = STATUS_FLOW[report.status];
    if (!nextStatus) return;
    const updated = await updateReportStatus({
      reference: report.reference,
      status: nextStatus,
      actorName: user.name,
      actorAgencyLabel: agency?.shortName ?? user.agency.toUpperCase(),
    });
    if (updated) {
      setReports((current) => current.map((item) => (item.reference === updated.reference ? updated : item)));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function generateDemoReports() {
    if (!user || !agency) return;
    setSeeding(true);
    await seedCitizenReportsForAgencyMock(agency, user.name);
    await load();
    setSeeding(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const heroAndNav = (
    <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 18 }}>
      <View style={[styles.hero, { backgroundColor: accent }]}>
        <View style={styles.heroTop}>
          <AgencyEmblem agency={user.agency} size={58} color="#fff" label={agency?.shortName ?? user.agency.toUpperCase()} />
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.84}>
            <Feather name="log-out" size={15} color="#fff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.kicker}>DYNAMIC AGENCY WORKSPACE</Text>
        <Text style={styles.title}>{agency?.shortName ?? user.agency.toUpperCase()}</Text>
        <Text style={styles.subtitle}>{agency?.fullName ?? "Agency operations workspace"}</Text>
        <Text style={styles.identity}>{user.name} · {roleLabel(user.agency, user.role)}</Text>
      </View>

      <View style={[styles.navBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {WORKSPACE_SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, { backgroundColor: active ? accent + "18" : "transparent" }]}
              onPress={() => setSection(item.id)}
              activeOpacity={0.84}
            >
              <Feather name={item.icon} size={17} color={active ? accent : colors.mutedForeground} />
              <Text style={[styles.navText, { color: active ? accent : colors.mutedForeground }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // The map section renders the shared interactive map full-height for parity
  // with built-in agencies; other sections scroll normally below the nav.
  if (section === "map") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {heroAndNav}
        <View style={{ flex: 1 }}>
          <CitizenReportMap
            title={`${agency?.shortName ?? user.agency.toUpperCase()} Location View`}
            subtitle="Citizen reports routed to this agency, with GPS markers and a manual-location fallback list."
            reports={reports}
            accentColor={accent}
            bottomPadding={insets.bottom + 24}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {heroAndNav}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 34 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
      {section === "overview" ? (
        <>
          <NotificationAccessCard accentColor={accent} />
          <View style={styles.metrics}>
            <Metric label="Reports" value={metrics.total} color={accent} />
            <Metric label="New" value={metrics.newWork} color="#C8960C" />
            <Metric label="Active" value={metrics.active} color="#0F4C81" />
            <Metric label="High" value={metrics.high} color="#C0392B" />
          </View>
          <View style={[styles.readinessCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Operational readiness</Text>
            <ReadinessItem ok label="Agency registry active" />
            <ReadinessItem ok label={`Demo accounts seeded from ${agency?.badgePrefix ?? "agency"} prefix`} />
            <ReadinessItem ok={reports.length > 0} label={reports.length > 0 ? "Routed citizen reports available" : "Waiting for routed citizen reports"} />
            <ReadinessItem ok={Boolean(agency?.tabRoute)} label="Backend-ready workspace route" />
          </View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent reports</Text>
            <Text style={[styles.count, { color: colors.mutedForeground }]}>{recentReports.length}</Text>
          </View>
          {recentReports.map((report) => <ReportCard key={report.reference} report={report} accent={accent} onAdvance={advanceStatus} />)}
        </>
      ) : null}

      {section === "reports" ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Case queue</Text>
            <Text style={[styles.count, { color: colors.mutedForeground }]}>{reports.length}</Text>
          </View>
          {reports.map((report) => <ReportCard key={report.reference} report={report} accent={accent} onAdvance={advanceStatus} />)}
        </>
      ) : null}

      {section === "tools" ? (
        <>
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Agency profile</Text>
            <ProfileRow label="Badge" value={user.badgeNumber} />
            <ProfileRow label="Role" value={roleLabel(user.agency, user.role)} />
            <ProfileRow label="Station" value={user.station} />
            <ProfileRow label="Sector" value={user.sector} />
          </View>
          <View style={[styles.toolsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Workspace tools</Text>
            <TouchableOpacity style={[styles.toolRow, { borderColor: colors.border }]} onPress={generateDemoReports} disabled={seeding} activeOpacity={0.84}>
              <View style={[styles.toolIcon, { backgroundColor: accent + "18" }]}>
                <Feather name="database" size={17} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toolTitle, { color: colors.text }]}>{reports.length > 0 ? "Refresh demo data" : "Generate demo reports"}</Text>
                <Text style={[styles.toolSub, { color: colors.mutedForeground }]}>Keep this agency populated for testing case queues, metrics, and status actions.</Text>
              </View>
              <Feather name={seeding ? "loader" : "chevron-right"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolRow, { borderColor: colors.border }]} onPress={() => router.push("/notifications" as any)} activeOpacity={0.84}>
              <View style={[styles.toolIcon, { backgroundColor: "#0F4C8118" }]}>
                <Feather name="bell" size={17} color="#0F4C81" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toolTitle, { color: colors.text }]}>Notification centre</Text>
                <Text style={[styles.toolSub, { color: colors.mutedForeground }]}>Review routed alerts, assignments, and status updates.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {reports.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="inbox" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No routed reports yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            This workspace is ready for agency-specific reports when Admin routing or the backend contract starts assigning citizen incidents to {agency?.shortName ?? user.agency}.
          </Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: accent }]} onPress={generateDemoReports} disabled={seeding} activeOpacity={0.84}>
            <Text style={styles.emptyBtnText}>{seeding ? "Preparing..." : "Generate Demo Reports"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </ScrollView>
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

function ReportCard({
  report,
  accent,
  onAdvance,
}: {
  report: CitizenIncidentReceipt;
  accent: string;
  onAdvance: (report: CitizenIncidentReceipt) => void;
}) {
  const colors = useColors();
  const nextStatus = STATUS_FLOW[report.status];
  return (
    <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.reportTop}>
        <Text style={[styles.reference, { color: colors.text }]}>{report.reference}</Text>
        <View style={[styles.statusPill, { backgroundColor: accent + "18" }]}>
          <Text style={[styles.statusText, { color: accent }]}>{formatCitizenIncidentStatus(report.status)}</Text>
        </View>
      </View>
      <Text style={[styles.reportType, { color: colors.mutedForeground }]}>{report.incidentType.replace(/_/g, " ").toUpperCase()} · {report.emergencyLevel.toUpperCase()}</Text>
      <Text style={[styles.description, { color: colors.text }]} numberOfLines={3}>{report.description}</Text>
      <Text style={[styles.location, { color: colors.mutedForeground }]} numberOfLines={2}>{report.location}</Text>
      {nextStatus ? (
        <TouchableOpacity style={[styles.progressBtn, { backgroundColor: accent }]} onPress={() => onAdvance(report)} activeOpacity={0.84}>
          <Feather name="arrow-right-circle" size={16} color="#fff" />
          <Text style={styles.progressText}>Mark {formatCitizenIncidentStatus(nextStatus)}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ReadinessItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.readinessItem}>
      <Feather name={ok ? "check-circle" : "clock"} size={16} color={ok ? "#27AE60" : "#C8960C"} />
      <Text style={styles.readinessText}>{label}</Text>
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.profileRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.profileValue, { color: colors.text }]}>{value || "Not set"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: 22, padding: 18, marginBottom: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  signOutBtn: { minHeight: 38, borderRadius: 999, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.16)" },
  signOutText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  kicker: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  title: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 8 },
  subtitle: { color: "rgba(255,255,255,0.86)", fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  identity: { color: "rgba(255,255,255,0.76)", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  navBar: { borderWidth: 1, borderRadius: 16, padding: 5, marginBottom: 12, flexDirection: "row", gap: 4 },
  navItem: { flex: 1, minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 4 },
  navText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 12 },
  metric: { width: "48.5%", borderWidth: 1, borderRadius: 16, padding: 13 },
  metricValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 2, textTransform: "uppercase" },
  readinessCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  readinessItem: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  readinessText: { color: "#344054", flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  toolsCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14, gap: 10 },
  toolRow: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  toolIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  toolTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  toolSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17, marginTop: 2 },
  profileCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  profileRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 10 },
  profileLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  profileValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  count: { fontSize: 12, fontFamily: "Inter_700Bold" },
  reportCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reference: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  reportType: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 6 },
  description: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20, marginTop: 8 },
  location: { fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 17, marginTop: 8 },
  progressBtn: { minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
  progressText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  mapCard: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: "center", gap: 8, marginBottom: 12 },
  mapIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  mapTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  mapSub: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, textAlign: "center" },
  locationCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  coordinates: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 6 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, textAlign: "center" },
  emptyBtn: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  emptyBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
