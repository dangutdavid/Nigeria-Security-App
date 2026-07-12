import type { AgencyType } from "@/context/AuthContext";
import { mobileApiFetch } from "@/services/apiClient";
import {
  AppNotification,
  createNotification,
  CreateNotificationInput,
  getUnreadNotificationCount,
  listAdminNotifications,
  listCitizenNotifications,
  listNotificationsForAgency,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationAudience,
} from "@/services/notificationService";
import { savePushToken as saveLocalPushToken } from "@/services/pushNotificationService";

export async function createAppNotification(input: CreateNotificationInput): Promise<AppNotification | null> {
  const api = await mobileApiFetch<{ notification?: AppNotification }, CreateNotificationInput>({
    method: "POST",
    path: "/notifications",
    body: input,
    requireAuth: input.audience !== "citizen",
  });

  if (api.ok) return api.data.notification ?? null;
  return createNotification(input);
}

export async function listNotifications(options: {
  userId?: string;
  agency?: AgencyType;
  audience?: NotificationAudience | "admin";
  reportReference?: string;
}): Promise<AppNotification[]> {
  const query = new URLSearchParams();
  if (options.userId) query.set("userId", options.userId);
  if (options.agency) query.set("agency", options.agency);
  if (options.audience) query.set("audience", options.audience);
  if (options.reportReference) query.set("reportReference", options.reportReference);

  const api = await mobileApiFetch<{ notifications?: AppNotification[] }>({
    method: "GET",
    path: `/notifications${query.toString() ? `?${query.toString()}` : ""}`,
    requireAuth: options.audience !== "citizen" && !options.reportReference,
  });

  if (api.ok) return api.data.notifications ?? [];
  if (options.audience === "citizen") return listCitizenNotifications(options.reportReference);
  if (options.agency === "admin" || options.audience === "admin") return listAdminNotifications();
  if (options.agency) return listNotificationsForAgency(options.agency);
  if (options.userId) return listNotificationsForUser(options.userId);
  return [];
}

export async function markRead(id: string): Promise<void> {
  const api = await mobileApiFetch<{ ok?: boolean }>({
    method: "PATCH",
    path: `/notifications/${encodeURIComponent(id)}/read`,
    requireAuth: true,
  });

  if (!api.ok) await markNotificationRead(id);
}

export async function markAllRead(filter?: {
  userId?: string;
  agency?: AgencyType;
  audience?: NotificationAudience;
  reportReference?: string;
}): Promise<void> {
  const api = await mobileApiFetch<{ ok?: boolean }, typeof filter>({
    method: "PATCH",
    path: "/notifications/read-all",
    body: filter,
    requireAuth: filter?.audience !== "citizen",
  });

  if (!api.ok) await markAllNotificationsRead(filter);
}

export async function unreadCount(filter?: {
  userId?: string;
  agency?: AgencyType;
  audience?: NotificationAudience;
  reportReference?: string;
}): Promise<number> {
  const api = await mobileApiFetch<{ count?: number }, typeof filter>({
    method: "POST",
    path: "/notifications/unread-count",
    body: filter,
    requireAuth: filter?.audience !== "citizen",
  });

  if (api.ok && typeof api.data.count === "number") return api.data.count;
  return getUnreadNotificationCount(filter);
}

export async function savePushToken(token: string): Promise<void> {
  const api = await mobileApiFetch<{ ok?: boolean }, { token: string }>({
    method: "POST",
    path: "/push-tokens",
    body: { token },
    requireAuth: true,
  });

  if (!api.ok) await saveLocalPushToken(token);
}
