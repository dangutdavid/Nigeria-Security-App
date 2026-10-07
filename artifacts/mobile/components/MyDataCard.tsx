import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { shouldUseApi } from "@/services/apiConfig";
import { findReportKey, type MyReportKey } from "@/services/myReportKeys";
import { exportMyReport, requestMyReportErasure } from "@/services/privacyRepository";

/**
 * "Your data" actions on a report submitted from this device: download a copy
 * (right of access) or ask for deletion (right to erasure). Only shown when the
 * device holds the report's private submission key.
 */
export function MyDataCard({ reference }: { reference: string }) {
  const colors = useColors();
  const router = useRouter();
  const [key, setKey] = useState<MyReportKey | null>(null);
  const [busy, setBusy] = useState<"export" | "erase" | null>(null);

  useEffect(() => {
    let alive = true;
    void findReportKey(reference).then((k) => alive && setKey(k));
    return () => {
      alive = false;
    };
  }, [reference]);

  if (!key || !shouldUseApi()) return null;

  async function download() {
    if (!key) return;
    setBusy("export");
    const res = await exportMyReport(key.reference, key.clientId);
    setBusy(null);
    if (!res.ok) return Alert.alert("Download failed", res.error);
    await Share.share({ title: `Report ${key.reference} — my data`, message: JSON.stringify(res.data, null, 2) });
  }

  function erase() {
    Alert.alert(
      "Request deletion",
      "We'll ask the data protection officer to delete the personal details in this report and its photos. Some information may have to be kept by law, for example if an investigation is open. You'll get an answer within one month.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send request",
          style: "destructive",
          onPress: async () => {
            if (!key) return;
            setBusy("erase");
            const res = await requestMyReportErasure(key.reference, key.clientId);
            setBusy(null);
            if (res.ok) Alert.alert("Request received", `Request ID: ${res.data.requestId}. Keep it for your records.`);
            else Alert.alert("Request failed", res.error);
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Feather name="shield" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Your data</Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>You submitted this report from this phone, so you can get a copy of it or ask for it to be deleted.</Text>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { borderColor: colors.primary }]} onPress={download} disabled={busy !== null}>
          {busy === "export" ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.btnText, { color: colors.primary }]}>Download my data</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { borderColor: colors.fatal }]} onPress={erase} disabled={busy !== null}>
          {busy === "erase" ? <ActivityIndicator color={colors.fatal} /> : <Text style={[styles.btnText, { color: colors.fatal }]}>Request deletion</Text>}
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => router.push("/privacy" as never)}>
        <Text style={[styles.link, { color: colors.primary }]}>How we use your information</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginTop: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  link: { fontSize: 13, fontFamily: "Inter_500Medium", textDecorationLine: "underline" },
});
