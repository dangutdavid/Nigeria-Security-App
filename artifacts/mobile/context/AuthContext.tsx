import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "field_officer" | "supervisor" | "commander";
export type UserStatus = "active" | "inactive" | "suspended";

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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (badgeNumber: string, pin: string) => Promise<LoginResult>;
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
  {
    pin: "1234",
    user: {
      id: "u1",
      name: "Okafor Emmanuel",
      badgeNumber: "FO-001",
      email: "o.emmanuel@frsc.gov.ng",
      role: "field_officer",
      sector: "Abuja FCT",
      station: "Kubwa Outpost",
      phone: "+234 803 111 2222",
      status: "active",
      createdAt: "2024-01-15T08:00:00.000Z",
    },
  },
  {
    pin: "1234",
    user: {
      id: "u2",
      name: "Adaeze Nwosu",
      badgeNumber: "SV-042",
      email: "a.nwosu@frsc.gov.ng",
      role: "supervisor",
      sector: "Abuja FCT",
      station: "FCT Sector Command",
      phone: "+234 805 333 4444",
      status: "active",
      createdAt: "2023-06-10T08:00:00.000Z",
    },
  },
  {
    pin: "1234",
    user: {
      id: "u3",
      name: "Brig. Usman Aliyu",
      badgeNumber: "CMD-007",
      email: "u.aliyu@frsc.gov.ng",
      role: "commander",
      sector: "North Central Zone",
      station: "Zonal Command HQ",
      phone: "+234 809 555 6666",
      status: "active",
      createdAt: "2022-03-01T08:00:00.000Z",
    },
  },
  {
    pin: "5678",
    user: {
      id: "u4",
      name: "Chukwudi Eze",
      badgeNumber: "FO-022",
      email: "c.eze@frsc.gov.ng",
      role: "field_officer",
      sector: "Lagos State",
      station: "Ikeja Checkpoint",
      phone: "+234 802 444 5555",
      status: "active",
      createdAt: "2024-03-20T08:00:00.000Z",
    },
  },
  {
    pin: "5678",
    user: {
      id: "u5",
      name: "Fatima Bello",
      badgeNumber: "FO-037",
      email: "f.bello@frsc.gov.ng",
      role: "field_officer",
      sector: "Kano State",
      station: "Kano Metro Command",
      phone: "+234 807 777 8888",
      status: "inactive",
      createdAt: "2024-05-01T08:00:00.000Z",
    },
  },
];

const AUTH_STORAGE_KEY = "@frsc_auth_user";
const USERS_STORAGE_KEY = "@frsc_users";
const OTP_STORAGE_KEY = "@frsc_pending_otp";
const OTP_VERIFIED_KEY = "@frsc_otp_verified";
const OTP_TTL_MS = 10 * 60 * 1000;

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
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedUsers) {
        const parsed: UserRecord[] = JSON.parse(storedUsers);
        const patched = parsed.map((r) => ({
          ...r,
          user: { ...r.user, email: r.user.email ?? "" },
        }));
        setRecords(patched);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function persistRecords(next: UserRecord[]) {
    setRecords(next);
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next));
  }

  async function login(badgeNumber: string, pin: string): Promise<LoginResult> {
    const entry = records.find((r) => r.user.badgeNumber.toUpperCase() === badgeNumber.toUpperCase());
    if (!entry || entry.pin !== pin) return "invalid";
    if (entry.user.status === "inactive") return "inactive";
    if (entry.user.status === "suspended") return "suspended";
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(entry.user));
    setUser(entry.user);
    return "ok";
  }

  async function logout() {
    await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, OTP_STORAGE_KEY, OTP_VERIFIED_KEY]);
    setUser(null);
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
  }

  async function updateUser(id: string, updates: Partial<Omit<User, "id" | "createdAt">>): Promise<void> {
    const next = records.map((r) => (r.user.id === id ? { ...r, user: { ...r.user, ...updates } } : r));
    await persistRecords(next);
    if (user?.id === id) {
      const updated = next.find((r) => r.user.id === id)?.user ?? null;
      if (updated) {
        setUser(updated);
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      }
    }
  }

  async function deleteUser(id: string): Promise<void> {
    const next = records.filter((r) => r.user.id !== id);
    await persistRecords(next);
  }

  async function resetPin(id: string, newPin: string): Promise<void> {
    const next = records.map((r) => (r.user.id === id ? { ...r, pin: newPin } : r));
    await persistRecords(next);
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, allUsers, addUser, updateUser, deleteUser, resetPin, getUserById, requestOtp, verifyOtp, resetPinWithOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
