import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { routeForUser, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function UnauthorizedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const workspaceRoute = routeForUser(user);
  const hasWorkspace = workspaceRoute !== "/unauthorized";

  async function handleSignOut() {
    await logout();
    router.replace("/");
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconWrap}>
          <Feather name="lock" size={30} color="#C0392B" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Restricted Area</Text>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          Your current role or agency does not have access to this part of the app.
        </Text>
        {hasWorkspace ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace(workspaceRoute as any)}>
            <Feather name="arrow-right" size={17} color="#fff" />
            <Text style={styles.primaryText}>Go to My Workspace</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSignOut}>
            <Feather name="log-out" size={17} color="#fff" />
            <Text style={styles.primaryText}>Sign Out</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={hasWorkspace ? () => router.replace("/") : handleSignOut}>
          <Feather name="home" size={17} color="#0F4C81" />
          <Text style={styles.secondaryText}>{hasWorkspace ? "Back to Home" : "Back to Sign In"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: 22 },
  card: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: "center", gap: 14 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#FEE8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  copy: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 21, textAlign: "center" },
  primaryBtn: {
    marginTop: 8,
    minHeight: 50,
    alignSelf: "stretch",
    borderRadius: 14,
    backgroundColor: "#0F4C81",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  secondaryBtn: {
    minHeight: 48,
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { color: "#0F4C81", fontSize: 15, fontFamily: "Inter_700Bold" },
});
