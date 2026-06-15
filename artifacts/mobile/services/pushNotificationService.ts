import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { createNotification, type AppNotificationType, type NotificationPriority } from "@/services/notificationService";

const PUSH_TOKEN_KEY = "@security_push_token_v1";

export interface PushRegistrationResult {
  ok: boolean;
  token?: string;
  reason?: string;
  requiresDevelopmentBuild?: boolean;
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  return {
    ok: false,
    reason: "expo-notifications is not installed yet. Local in-app notifications remain available.",
    requiresDevelopmentBuild: Platform.OS !== "web",
  };
}

export async function savePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function getSavedPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function scheduleLocalNotification({
  title,
  body,
  type = "admin_action",
  priority = "normal",
  reportReference,
  agency,
}: {
  title: string;
  body: string;
  type?: AppNotificationType;
  priority?: NotificationPriority;
  reportReference?: string;
  agency?: string;
}) {
  return createNotification({
    type,
    audience: agency ? "agency" : "citizen",
    agency,
    title,
    message: body,
    priority,
    reportReference,
  });
}

export async function sendMockPushNotification({
  title,
  body,
  reportReference,
  agency,
}: {
  title: string;
  body: string;
  reportReference?: string;
  agency?: string;
}) {
  return scheduleLocalNotification({
    title,
    body,
    reportReference,
    agency,
    type: "admin_action",
  });
}
