import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AgencyType, UserRole } from "@/context/AuthContext";
import type { CitizenEmergencyLevel } from "@/services/citizenIncidentApi";

export type AppNotificationType =
  | "citizen_report_submitted"
  | "case_assigned"
  | "status_changed"
  | "report_reassigned"
  | "agency_referral_received"
  | "nearby_high_priority_alert"
  | "officer_dispatch_request"
  | "admin_action";

export type NotificationAudience = "citizen" | "agency" | "admin" | "user";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  audience: NotificationAudience;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  agency?: AgencyType;
  userId?: string;
  role?: UserRole;
  reportReference?: string;
  incidentId?: string;
  route?: string;
  priority: NotificationPriority;
  sourceAgency?: AgencyType | "admin" | "citizen";
  metadata?: Record<string, string | number | boolean | null>;
}

export interface NotificationPreferences {
  enabled: boolean;
  highPriorityOnly: boolean;
  agencyAssignmentAlerts: boolean;
  statusUpdateAlerts: boolean;
}

export type CreateNotificationInput = Omit<AppNotification, "id" | "createdAt" | "priority"> & {
  id?: string;
  createdAt?: string;
  priority?: NotificationPriority;
};

const NOTIFICATION_STORAGE_KEY = "@security_notifications_v1";
const NOTIFICATION_PREFS_KEY = "@security_notification_preferences_v1";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  highPriorityOnly: false,
  agencyAssignmentAlerts: true,
  statusUpdateAlerts: true,
};

function makeNotificationId() {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readNotifications(): Promise<AppNotification[]> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeNotifications(notifications: AppNotification[]) {
  await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
}

export function priorityFromEmergency(level?: CitizenEmergencyLevel): NotificationPriority {
  if (level === "critical") return "critical";
  if (level === "high") return "high";
  return "normal";
}

export function notificationPreferenceKeyForUser(userId?: string, agency?: AgencyType) {
  return userId ? `user:${userId}` : agency ? `agency:${agency}` : "public";
}

async function readPreferenceMap(): Promise<Record<string, NotificationPreferences>> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getNotificationPreferences(key = "public"): Promise<NotificationPreferences> {
  const map = await readPreferenceMap();
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(map[key] ?? {}) };
}

export async function updateNotificationPreferences(
  key: string,
  updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const map = await readPreferenceMap();
  const next = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(map[key] ?? {}), ...updates };
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify({ ...map, [key]: next }));
  return next;
}

function isAllowedByPreferences(notification: AppNotification, prefs: NotificationPreferences) {
  if (!prefs.enabled) return false;
  if (prefs.highPriorityOnly && notification.priority !== "high" && notification.priority !== "critical") return false;
  if (!prefs.agencyAssignmentAlerts && (notification.type === "case_assigned" || notification.type === "agency_referral_received")) return false;
  if (!prefs.statusUpdateAlerts && notification.type === "status_changed") return false;
  return true;
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification | null> {
  const notification: AppNotification = {
    ...input,
    id: input.id ?? makeNotificationId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    priority: input.priority ?? "normal",
  };

  const prefKey = notificationPreferenceKeyForUser(notification.userId, notification.agency);
  const prefs = await getNotificationPreferences(prefKey);
  if (!isAllowedByPreferences(notification, prefs)) return null;

  const notifications = await readNotifications();
  await writeNotifications([notification, ...notifications]);
  return notification;
}

export async function listNotificationsForUser(userId: string): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  return notifications.filter((notification) => notification.userId === userId);
}

export async function listNotificationsForAgency(agency: AgencyType): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  return notifications.filter((notification) => notification.agency === agency || notification.audience === "admin" && agency === "admin");
}

export async function listCitizenNotifications(reference?: string): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  return notifications.filter((notification) => {
    if (notification.audience !== "citizen") return false;
    if (!reference?.trim()) return true;
    return notification.reportReference?.toUpperCase() === reference.trim().toUpperCase();
  });
}

export async function listAdminNotifications(): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  return notifications.filter((notification) => notification.audience === "admin" || notification.agency === "admin");
}

export async function markNotificationRead(id: string): Promise<void> {
  const notifications = await readNotifications();
  const now = new Date().toISOString();
  await writeNotifications(notifications.map((notification) => (
    notification.id === id ? { ...notification, readAt: notification.readAt ?? now } : notification
  )));
}

export async function markAllNotificationsRead(filter?: {
  userId?: string;
  agency?: AgencyType;
  audience?: NotificationAudience;
  reportReference?: string;
}): Promise<void> {
  const notifications = await readNotifications();
  const now = new Date().toISOString();
  await writeNotifications(notifications.map((notification) => {
    const matchesUser = !filter?.userId || notification.userId === filter.userId;
    const matchesAgency = !filter?.agency || notification.agency === filter.agency;
    const matchesAudience = !filter?.audience || notification.audience === filter.audience;
    const matchesReference = !filter?.reportReference || notification.reportReference?.toUpperCase() === filter.reportReference.toUpperCase();
    return matchesUser && matchesAgency && matchesAudience && matchesReference
      ? { ...notification, readAt: notification.readAt ?? now }
      : notification;
  }));
}

export async function getUnreadNotificationCount(filter?: {
  userId?: string;
  agency?: AgencyType;
  audience?: NotificationAudience;
  reportReference?: string;
}): Promise<number> {
  const notifications = await readNotifications();
  return notifications.filter((notification) => {
    if (notification.readAt) return false;
    if (filter?.userId && notification.userId !== filter.userId) return false;
    if (filter?.agency && notification.agency !== filter.agency) return false;
    if (filter?.audience && notification.audience !== filter.audience) return false;
    if (filter?.reportReference && notification.reportReference?.toUpperCase() !== filter.reportReference.toUpperCase()) return false;
    return true;
  }).length;
}
