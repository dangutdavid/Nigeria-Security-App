import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AgencyProvider } from "@/context/AgencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { CrimeReportProvider } from "@/context/CrimeReportContext";
import { IncidentProvider } from "@/context/IncidentContext";
import { InspectionProvider } from "@/context/InspectionContext";
import { PatrolProvider } from "@/context/PatrolContext";
import { ReferralProvider } from "@/context/ReferralContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { TheftReportProvider } from "@/context/TheftReportContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(police)" options={{ headerShown: false }} />
      <Stack.Screen name="(vio)" options={{ headerShown: false }} />
      <Stack.Screen name="report" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="case/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="analytics" options={{ headerShown: false }} />
      <Stack.Screen name="users" options={{ headerShown: false }} />
      <Stack.Screen name="user-form" options={{ headerShown: false }} />
      <Stack.Screen name="vehicle-lookup" options={{ headerShown: false }} />
      <Stack.Screen name="patrol-log" options={{ headerShown: false }} />
      <Stack.Screen name="change-pin" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-pin" options={{ headerShown: false }} />
      <Stack.Screen name="otp-verify" options={{ headerShown: false }} />
      <Stack.Screen name="reset-pin" options={{ headerShown: false }} />
      <Stack.Screen name="logout" options={{ headerShown: false }} />
      <Stack.Screen name="report-theft" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="theft-alerts" options={{ headerShown: false }} />
      <Stack.Screen name="crime/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="inspection/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="referrals" options={{ headerShown: false }} />
      <Stack.Screen name="analytics-police" options={{ headerShown: false }} />
      <Stack.Screen name="analytics-vio" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AgencyProvider>
              <AuthProvider>
                <IncidentProvider>
                  <TheftReportProvider>
                    <CrimeReportProvider>
                      <InspectionProvider>
                        <PatrolProvider>
                          <ReferralProvider>
                            <GestureHandlerRootView style={{ flex: 1 }}>
                              <KeyboardProvider>
                                <RootLayoutNav />
                              </KeyboardProvider>
                            </GestureHandlerRootView>
                          </ReferralProvider>
                        </PatrolProvider>
                      </InspectionProvider>
                    </CrimeReportProvider>
                  </TheftReportProvider>
                </IncidentProvider>
              </AuthProvider>
            </AgencyProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
