import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "field_officer" | "supervisor" | "commander";
export type UserStatus = "active" | "inactive" | "suspended";

export interface User {
  id: string;
  name: string;
  badgeNumber: string;
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (badgeNumber: string, pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  // User management
  allUsers: User[];
  addUser: (user: Omit<User, "id" | "createdAt">, pin: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<Omit<User, "id" | "createdAt">>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPin: (id: string, newPin: string) => Promise<void>;
  getUserById: (id: string) => User | undefined;
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
});

const SEED_RECORDS: UserRecord[] = [
  {
    pin: "1234",
    user: {
      id: "u1",
      name: "Okafor Emmanuel",
      badgeNumber: "FO-001",
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<UserRecord[]>(SEED_RECORDS);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [storedUser, storedUsers] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(USERS_STORAGE_KEY),
      ]);
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedUsers) setRecords(JSON.parse(storedUsers));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function persistRecords(next: UserRecord[]) {
    setRecords(next);
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next));
  }

  async function login(badgeNumber: string, pin: string): Promise<LoginResult> {
    const entry = records.find(
      (r) => r.user.badgeNumber.toUpperCase() === badgeNumber.toUpperCase()
    );
    if (!entry || entry.pin !== pin) return "invalid";
    if (entry.user.status === "inactive") return "inactive";
    if (entry.user.status === "suspended") return "suspended";
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(entry.user));
    setUser(entry.user);
    return "ok";
  }

  async function logout() {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }

  async function addUser(
    newUser: Omit<User, "id" | "createdAt">,
    pin: string
  ): Promise<void> {
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

  async function updateUser(
    id: string,
    updates: Partial<Omit<User, "id" | "createdAt">>
  ): Promise<void> {
    const next = records.map((r) =>
      r.user.id === id ? { ...r, user: { ...r.user, ...updates } } : r
    );
    await persistRecords(next);
    // Keep active session in sync
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
    const next = records.map((r) =>
      r.user.id === id ? { ...r, pin: newPin } : r
    );
    await persistRecords(next);
  }

  function getUserById(id: string): User | undefined {
    return records.find((r) => r.user.id === id)?.user;
  }

  const allUsers = records.map((r) => r.user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        allUsers,
        addUser,
        updateUser,
        deleteUser,
        resetPin,
        getUserById,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
