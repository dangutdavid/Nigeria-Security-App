import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAgency } from "@/context/AgencyContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LogoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const { clearAgency } = useAgency();

  // Clear the authenticated session as soon as this screen mounts. This screen
  // lives at the root (outside the agency tab groups), so it is not affected by
  // their auth-guard redirects — that is exactly why we sign out here instead of
  // inside the guarded profile screens.
  useEffect(() => {
    void logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoToLogin() {
    await clearAgency();
    router.replace("/");
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: "#F3F4F6" }]}>
          <Feather name="log-out" size={28} color="#374151" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>You&apos;re signed out</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Tap below to return to the agency selection screen.
        </Text>
        <Pressable
          onPress={handleGoToLogin}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: "#1B5E3B", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="log-in" size={16} color="#fff" />
          <Text style={styles.buttonText}>Select Agency</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: "center" },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8, lineHeight: 20 },
  button: { marginTop: 22, height: 52, borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" },
  buttonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
