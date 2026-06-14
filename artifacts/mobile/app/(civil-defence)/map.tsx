import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CitizenIncidentReceipt, listNscdcCitizenIncidentReports } from "@/services/citizenIncidentApi";

export default function CivilDefenceMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);
  useFocusEffect(useCallback(() => { void listNscdcCitizenIncidentReports().then(setReports); }, []));

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}>
      <View style={styles.mapHero}>
        <Feather name="map" size={34} color="#fff" />
        <Text style={styles.title}>NSCDC Location View</Text>
        <Text style={styles.sub}>Local mock map support: showing captured/manual report locations until native geospatial layers are added.</Text>
      </View>
      {reports.map((report) => (
        <TouchableOpacity key={report.reference} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push("/(civil-defence)/incidents" as any)}>
          <View style={styles.row}>
            <Feather name="map-pin" size={18} color="#234E2A" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ref, { color: colors.text }]}>{report.reference}</Text>
              <Text style={[styles.loc, { color: colors.mutedForeground }]}>{report.location}</Text>
              {report.latitude && report.longitude ? <Text style={styles.gps}>{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</Text> : null}
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {reports.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>No NSCDC report locations yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapHero: { backgroundColor: "#234E2A", borderRadius: 22, padding: 18, marginBottom: 14 },
  title: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 10 },
  sub: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  ref: { fontSize: 15, fontFamily: "Inter_700Bold" },
  loc: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18, marginTop: 3 },
  gps: { color: "#234E2A", fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 32, fontFamily: "Inter_600SemiBold" },
});
