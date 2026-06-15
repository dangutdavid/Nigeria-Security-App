import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { createAuditEvent } from "@/services/auditLogService";

export type UserRole = "citizen" | "officer" | "supervisor" | "commander" | "admin" | "super_admin";
export type UserStatus = "active" | "inactive" | "suspended";
export type AgencyType = string;

export interface User {
  id: string;
  name: string;
  badgeNumber: string;
  email: string;
  role: UserRole;
  sector: string;
  station: string;
  phone: string;
  status: UserStatus;
  createdAt: string;
  agency: AgencyType;
}

export interface UserRecord {
  user: User;
  pin: string;
}

export type LoginResult = "ok" | "invalid" | "inactive" | "suspended";
export type OtpResult = "sent" | "not_found" | "email_mismatch";
export type OtpVerifyResult = "ok" | "invalid" | "expired";

interface PendingOtp {
  badgeNumber: string;
  code: string;
  expiresAt: number;
}

type StoredUser = Omit<User, "role" | "agency"> & {
  role: UserRole | "field_officer";
  agency?: AgencyType;
};

type StoredUserRecord = Omit<UserRecord, "user"> & { user: StoredUser };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (badgeNumber: string, pin: string, agency?: AgencyType) => Promise<LoginResult>;
  logout: () => Promise<void>;
  allUsers: User[];
  addUser: (user: Omit<User, "id" | "createdAt">, pin: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<Omit<User, "id" | "createdAt">>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPin: (id: string, newPin: string) => Promise<void>;
  getUserById: (id: string) => User | undefined;
  requestOtp: (badgeNumber: string, email: string) => Promise<{ result: OtpResult; code?: string }>;
  verifyOtp: (badgeNumber: string, code: string) => Promise<OtpVerifyResult>;
  resetPinWithOtp: (badgeNumber: string, newPin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => "invalid",
  logout: async () => {},
  allUsers: [],
  addUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  resetPin: async () => {},
  getUserById: () => undefined,
  requestOtp: async () => ({ result: "not_found" }),
  verifyOtp: async () => "invalid",
  resetPinWithOtp: async () => false,
});

const SEED_RECORDS: UserRecord[] = [
  // ── FRSC ───────────────────────────────────────────────
  {
    pin: "1234",
    user: {
      id: "u1", name: "Okafor Emmanuel", badgeNumber: "FO-001",
      email: "o.emmanuel@frsc.gov.ng", role: "officer",
      sector: "Abuja FCT", station: "Kubwa Outpost",
      phone: "+234 803 111 2222", status: "active",
      createdAt: "2024-01-15T08:00:00.000Z", agency: "frsc",
    },
  },
  {
    pin: "1234",
    user: {
      id: "u2", name: "Adaeze Nwosu", badgeNumber: "SV-042",
      email: "a.nwosu@frsc.gov.ng", role: "supervisor",
      sector: "Abuja FCT", station: "FCT Sector Command",
      phone: "+234 805 333 4444", status: "active",
      createdAt: "2023-06-10T08:00:00.000Z", agency: "frsc",
    },
  },
  {
    pin: "1234",
    user: {
      id: "u3", name: "Brig. Usman Aliyu", badgeNumber: "CMD-007",
      email: "u.aliyu@frsc.gov.ng", role: "commander",
      sector: "North Central Zone", station: "Zonal Command HQ",
      phone: "+234 809 555 6666", status: "active",
      createdAt: "2022-03-01T08:00:00.000Z", agency: "frsc",
    },
  },
  {
    pin: "5678",
    user: {
      id: "u4", name: "Chukwudi Eze", badgeNumber: "FO-022",
      email: "c.eze@frsc.gov.ng", role: "officer",
      sector: "Lagos State", station: "Ikeja Checkpoint",
      phone: "+234 802 444 5555", status: "active",
      createdAt: "2024-03-20T08:00:00.000Z", agency: "frsc",
    },
  },
  {
    pin: "5678",
    user: {
      id: "u5", name: "Fatima Bello", badgeNumber: "FO-037",
      email: "f.bello@frsc.gov.ng", role: "officer",
      sector: "Kano State", station: "Kano Metro Command",
      phone: "+234 807 777 8888", status: "inactive",
      createdAt: "2024-05-01T08:00:00.000Z", agency: "frsc",
    },
  },
  // ── Nigeria Police Force ────────────────────────────────
  {
    pin: "1234",
    user: {
      id: "p1", name: "Insp. Chukwuemeka Okonkwo", badgeNumber: "NPF-001",
      email: "c.okonkwo@npf.gov.ng", role: "officer",
      sector: "FCT Command", station: "Maitama Divisional HQ",
      phone: "+234 803 222 3333", status: "active",
      createdAt: "2023-09-01T08:00:00.000Z", agency: "police",
    },
  },
  {
    pin: "1234",
    user: {
      id: "p2", name: "DSP Aisha Ibrahim", badgeNumber: "NPF-042",
      email: "a.ibrahim@npf.gov.ng", role: "supervisor",
      sector: "Lagos State Command", station: "Area 'E' Command Festac",
      phone: "+234 805 444 5555", status: "active",
      createdAt: "2022-11-15T08:00:00.000Z", agency: "police",
    },
  },
  {
    pin: "1234",
    user: {
      id: "p3", name: "ACP Rotimi Adeyemi", badgeNumber: "NPF-CMD",
      email: "r.adeyemi@npf.gov.ng", role: "commander",
      sector: "South West Zone", station: "Zonal HQ Onikan",
      phone: "+234 809 666 7777", status: "active",
      createdAt: "2021-06-01T08:00:00.000Z", agency: "police",
    },
  },
  // ── Vehicle Inspection Officers ─────────────────────────
  {
    pin: "1234",
    user: {
      id: "v1", name: "Officer Grace Okafor", badgeNumber: "VIO-001",
      email: "g.okafor@vio.gov.ng", role: "officer",
      sector: "FCT VIO", station: "Abuja VIO Centre",
      phone: "+234 803 888 9999", status: "active",
      createdAt: "2024-02-01T08:00:00.000Z", agency: "vio",
    },
  },
  {
    pin: "1234",
    user: {
      id: "v2", name: "Sr. Inspector Musa Danjuma", badgeNumber: "VIO-SV2",
      email: "m.danjuma@vio.gov.ng", role: "supervisor",
      sector: "Kano VIO", station: "Kano VIO Centre",
      phone: "+234 805 000 1111", status: "active",
      createdAt: "2023-03-10T08:00:00.000Z", agency: "vio",
    },
  },
  {
    pin: "1234",
    user: {
      id: "v3", name: "Director Ngozi Eze", badgeNumber: "VIO-CMD",
      email: "n.eze@vio.gov.ng", role: "commander",
      sector: "National VIO HQ", station: "FRSC National HQ",
      phone: "+234 809 222 3333", status: "active",
      createdAt: "2021-01-15T08:00:00.000Z", agency: "vio",
    },
  },
  // ── Civil Defence / NSCDC ───────────────────────────────
  {
    pin: "1234",
    user: {
      id: "c1", name: "Officer Daniel Musa", badgeNumber: "NSCDC-001",
      email: "d.musa@nscdc.gov.ng", role: "officer",
      sector: "FCT Command", station: "Wuse Response Unit",
      phone: "+234 803 555 1212", status: "active",
      createdAt: "2024-04-01T08:00:00.000Z", agency: "civil_defence",
    },
  },
  {
    pin: "1234",
    user: {
      id: "c2", name: "ASC Halima Yusuf", badgeNumber: "NSCDC-SV",
      email: "h.yusuf@nscdc.gov.ng", role: "supervisor",
      sector: "Lagos Command", station: "Ikeja Civil Defence Office",
      phone: "+234 805 555 3434", status: "active",
      createdAt: "2023-08-10T08:00:00.000Z", agency: "civil_defence",
    },
  },
  {
    pin: "1234",
    user: {
      id: "c3", name: "Commandant Peter Ade", badgeNumber: "NSCDC-CMD",
      email: "p.ade@nscdc.gov.ng", role: "commander",
      sector: "National Command", station: "NSCDC Headquarters",
      phone: "+234 809 555 5656", status: "active",
      createdAt: "2021-05-20T08:00:00.000Z", agency: "civil_defence",
    },
  },
  // ── Platform Administration ─────────────────────────────
  {
    pin: "1234",
    user: {
      id: "a1", name: "Admin Miriam Bello", badgeNumber: "ADMIN-001",
      email: "m.bello@security.gov.ng", role: "admin",
      sector: "Platform Operations", station: "Operations Centre",
      phone: "+234 803 555 7878", status: "active",
      createdAt: "2022-01-15T08:00:00.000Z", agency: "admin",
    },
  },
  {
    pin: "1234",
    user: {
      id: "a2", name: "Super Admin Tunde Lawal", badgeNumber: "SUPER-001",
      email: "t.lawal@security.gov.ng", role: "super_admin",
      sector: "National Platform Administration", station: "System Control",
      phone: "+234 809 555 9090", status: "active",
      createdAt: "2021-01-01T08:00:00.000Z", agency: "admin",
    },
  },
];

const AUTH_STORAGE_KEY = "@frsc_auth_user";
const USERS_STORAGE_KEY = "@frsc_users";
const OTP_STORAGE_KEY = "@frsc_pending_otp";
const OTP_VERIFIED_KEY = "@frsc_otp_verified";
const OTP_TTL_MS = 10 * 60 * 1000;

export function normalizeRole(role: UserRole | "field_officer" | undefined): UserRole {
  if (role === "field_officer") return "officer";
  return role ?? "officer";
}

function normalizeAgency(agency: AgencyType | undefined): AgencyType {
  return agency ?? "frsc";
}

function normalizeUser(user: StoredUser | User): User {
  return {
    ...user,
    role: normalizeRole(user.role),
    agency: normalizeAgency(user.agency),
  };
}

export function routeForUser(user: User | null | undefined): string {
  if (!user) return "/";
  if (user.role === "admin" || user.role === "super_admin" || user.agency === "admin") return "/(admin)";
  if (user.agency === "police") return "/(police)";
  if (user.agency === "vio") return "/(vio)";
  if (user.agency === "civil_defence") return "/(civil-defence)";
  if (user.agency === "frsc") return "/(tabs)";
  return "/unauthorized";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<UserRecord[]>(SEED_RECORDS);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    try {
      const [storedUser, storedUsers] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(USERS_STORAGE_KEY),
      ]);
      if (storedUser) {
        const parsed: StoredUser = JSON.parse(storedUser);
        setUser(normalizeUser(parsed));
      }
      if (storedUsers) {
        const parsed: StoredUserRecord[] = JSON.parse(storedUsers);
        const patched: UserRecord[] = parsed.map((r) => ({
          ...r,
          user: normalizeUser({ ...r.user, email: r.user.email ?? "" }),
        }));
        // Merge stored users with seeds so new agency seed users are always present
        const storedIds = new Set(patched.map((r) => r.user.id));
        const seedsToAdd = SEED_RECORDS.filter((s) => !storedIds.has(s.user.id));
        setRecords([...patched, ...seedsToAdd]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function persistRecords(next: UserRecord[]) {
    setRecords(next);
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next));
  }

  async function login(badgeNumber: string, pin: string, agency?: AgencyType): Promise<LoginResult> {
    const entry = records.find((r) => {
      const badgeMatch = r.user.badgeNumber.toUpperCase() === badgeNumber.toUpperCase();
      const agencyMatch = agency ? r.user.agency === agency : true;
      return badgeMatch && agencyMatch;
    });
    if (!entry || entry.pin !== pin) {
      await createAuditEvent({
        type: "auth.failed_login",
        title: "Failed login attempt",
        detail: `Failed login for badge ${badgeNumber.toUpperCase()}${agency ? ` in ${agency}` : ""}.`,
        actor: { name: badgeNumber.toUpperCase(), agency },
        agency,
        severity: "warning",
        metadata: { reason: "invalid_credentials" },
      });
      return "invalid";
    }
    if (entry.user.status === "inactive") {
      await auditAuthBlocked(entry.user, "inactive");
      return "inactive";
    }
    if (entry.user.status === "suspended") {
      await auditAuthBlocked(entry.user, "suspended");
      return "suspended";
    }
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(entry.user));
    setUser(entry.user);
    await createAuditEvent({
      type: "auth.login",
      title: "User signed in",
      detail: `${entry.user.name} signed in to ${entry.user.agency}.`,
      actor: { id: entry.user.id, name: entry.user.name, agency: entry.user.agency, role: entry.user.role },
      agency: entry.user.agency,
      severity: "info",
    });
    return "ok";
  }

  async function logout() {
    const previousUser = user;
    await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, OTP_STORAGE_KEY, OTP_VERIFIED_KEY]);
    setUser(null);
    if (previousUser) {
      await createAuditEvent({
        type: "auth.logout",
        title: "User signed out",
        detail: `${previousUser.name} signed out.`,
        actor: { id: previousUser.id, name: previousUser.name, agency: previousUser.agency, role: previousUser.role },
        agency: previousUser.agency,
        severity: "info",
      });
    }
  }

  async function addUser(newUser: Omit<User, "id" | "createdAt">, pin: string): Promise<void> {
    const record: UserRecord = {
      pin,
      user: {
        ...newUser,
        id: `u${Date.now()}`,
        createdAt: new Date().toISOString(),
      },
    };
    await persistRecords([...records, record]);
    await createAuditEvent({
      type: "user.created",
      title: "User created",
      detail: `${record.user.name} was created for ${record.user.agency}.`,
      actor: auditActor(user),
      agency: record.user.agency,
      targetId: record.user.id,
      severity: "info",
      metadata: { role: record.user.role, badgeNumber: record.user.badgeNumber },
    });
  }

  async function updateUser(id: string, updates: Partial<Omit<User, "id" | "createdAt">>): Promise<void> {
    const before = records.find((r) => r.user.id === id)?.user;
    const next = records.map((r) => (r.user.id === id ? { ...r, user: { ...r.user, ...updates } } : r));
    await persistRecords(next);
    const after = next.find((r) => r.user.id === id)?.user;
    if (after) {
      await createAuditEvent({
        type: "user.updated",
        title: "User updated",
        detail: `${after.name} was updated.`,
        actor: auditActor(user),
        agency: after.agency,
        targetId: after.id,
        severity: updates.status === "suspended" ? "warning" : "info",
        metadata: {
          changedFields: Object.keys(updates).join(", "),
          previousStatus: before?.status,
          nextStatus: after.status,
        },
      });
    }
    if (user?.id === id) {
      const updated = next.find((r) => r.user.id === id)?.user ?? null;
      if (updated) {
        setUser(updated);
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      }
    }
  }

  async function deleteUser(id: string): Promise<void> {
    const deleted = records.find((r) => r.user.id === id)?.user;
    const next = records.filter((r) => r.user.id !== id);
    await persistRecords(next);
    if (deleted) {
      await createAuditEvent({
        type: "user.deleted",
        title: "User deleted",
        detail: `${deleted.name} was removed from ${deleted.agency}.`,
        actor: auditActor(user),
        agency: deleted.agency,
        targetId: deleted.id,
        severity: "warning",
      });
    }
  }

  async function resetPin(id: string, newPin: string): Promise<void> {
    const next = records.map((r) => (r.user.id === id ? { ...r, pin: newPin } : r));
    await persistRecords(next);
    const changed = next.find((r) => r.user.id === id)?.user;
    if (changed) {
      await createAuditEvent({
        type: "user.pin_reset",
        title: "User PIN reset",
        detail: `PIN reset completed for ${changed.name}.`,
        actor: auditActor(user),
        agency: changed.agency,
        targetId: changed.id,
        severity: "warning",
      });
    }
  }

  function getUserById(id: string): User | undefined {
    return records.find((r) => r.user.id === id)?.user;
  }

  async function requestOtp(badgeNumber: string, email: string): Promise<{ result: OtpResult; code?: string }> {
    const entry = records.find((r) => r.user.badgeNumber.toUpperCase() === badgeNumber.toUpperCase());
    if (!entry) return { result: "not_found" };
    if (entry.user.email.toLowerCase() !== email.toLowerCase()) return { result: "email_mismatch" };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await AsyncStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({ badgeNumber: badgeNumber.toUpperCase(), code, expiresAt: Date.now() + OTP_TTL_MS }));
    await AsyncStorage.removeItem(OTP_VERIFIED_KEY);
    return { result: "sent", code };
  }

  async function verifyOtp(badgeNumber: string, code: string): Promise<OtpVerifyResult> {
    const raw = await AsyncStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return "invalid";
    const otp: PendingOtp = JSON.parse(raw);
    if (otp.badgeNumber !== badgeNumber.toUpperCase()) return "invalid";
    if (Date.now() > otp.expiresAt) {
      await AsyncStorage.removeItem(OTP_STORAGE_KEY);
      return "expired";
    }
    if (otp.code !== code.trim()) return "invalid";
    await AsyncStorage.setItem(OTP_VERIFIED_KEY, badgeNumber.toUpperCase());
    await AsyncStorage.removeItem(OTP_STORAGE_KEY);
    return "ok";
  }

  async function resetPinWithOtp(badgeNumber: string, newPin: string): Promise<boolean> {
    const verified = await AsyncStorage.getItem(OTP_VERIFIED_KEY);
    if (verified !== badgeNumber.toUpperCase()) return false;
    const entry = records.find((r) => r.user.badgeNumber.toUpperCase() === badgeNumber.toUpperCase());
    if (!entry) return false;
    await resetPin(entry.user.id, newPin);
    await AsyncStorage.removeItem(OTP_VERIFIED_KEY);
    return true;
  }

  const allUsers = records.map((r) => r.user);

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, logout,
      allUsers, addUser, updateUser, deleteUser, resetPin, getUserById,
      requestOtp, verifyOtp, resetPinWithOtp,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

function auditActor(user: User | null): { id?: string; name: string; agency?: AgencyType; role?: UserRole } {
  return user
    ? { id: user.id, name: user.name, agency: user.agency, role: user.role }
    : { name: "System" };
}

async function auditAuthBlocked(user: User, reason: "inactive" | "suspended") {
  await createAuditEvent({
    type: "auth.failed_login",
    title: "Blocked login attempt",
    detail: `${user.name} attempted login while ${reason}.`,
    actor: { id: user.id, name: user.name, agency: user.agency, role: user.role },
    agency: user.agency,
    targetId: user.id,
    severity: "warning",
    metadata: { reason },
  });
}
