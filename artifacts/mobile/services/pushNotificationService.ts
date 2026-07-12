import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { createNotification, type AppNotificationType, type NotificationPriority } from "@/services/notificationService";

const PUSH_TOKEN_KEY = "@security_push_token_v1";

export interface PushRegistrationResult {
  ok: boolean;
  token?: string;
  reason?: string;
  requiresDevelopmentBuild?: boolean;
}

// Show incoming pushes as banners while the app is foregrounded.
// expo-notifications is native-only; every entry point below no-ops on web.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Register this device for Expo push notifications: ask permission, create the
 * Android channel, fetch the Expo push token, and persist it locally. The
 * caller registers the token with the backend (notificationRepository) so this
 * module stays free of API-layer imports.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return { ok: false, reason: "Push notifications are not supported on web. In-app notifications remain available." };
  }
  if (!Device.isDevice) {
    return { ok: false, reason: "Push notifications need a physical device (not a simulator)." };
  }
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") {
      return { ok: false, reason: "Notification permission was not granted. Enable it in device settings." };
    }
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await savePushToken(token);
    return { ok: true, token };
  } catch (error) {
    // Expo Go (SDK 53+) does not support remote push — a development build is required.
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Push registration failed.",
      requiresDevelopmentBuild: true,
    };
  }
}

/**
 * Subscribe to notification taps and route to the screen carried in the push
 * payload (`data.route`, set by the backend dispatcher). Returns the
 * unsubscribe function. Also handles the cold-start tap.
 */
export function addNotificationRouting(navigate: (route: string) => void): () => void {
  if (Platform.OS === "web") return () => {};

  const handleResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as { route?: string } | undefined;
    if (data?.route && typeof data.route === "string") navigate(data.route);
    else navigate("/notifications");
  };

  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
  // Cold start: the app may have been launched by tapping a notification.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleResponse(response);
  });
  return () => sub.remove();
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
