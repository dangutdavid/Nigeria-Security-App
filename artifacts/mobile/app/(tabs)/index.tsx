import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useIncidents } from "@/context/IncidentContext";
import { IncidentCard } from "@/components/IncidentCard";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { incidents } = useIncidents();

  const myReports = incidents.filter((incident) => incident.reportedBy);
  const recent = incidents.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {myReports.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MY RECENT REPORTS</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>All cases</Text>
              </TouchableOpacity>
            </View>
            {myReports.map((inc, index) => <IncidentCard key={`${inc.id}-${index}`} incident={inc} />)}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT INCIDENTS</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recent.map((inc, index) => <IncidentCard key={`${inc.id}-${index}`} incident={inc} />)}
        </View>
      </View>
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.secondary }]} onPress={() => router.push("/report")}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  fab: { position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
