import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "field_officer" | "supervisor" | "commander";

export interface User {
  id: string;
  name: string;
  badgeNumber: string;
  role: UserRole;
  sector: string;
  station: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (badgeNumber: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
});

const DEMO_USERS: Record<string, { pin: string; user: User }> = {
  "FO-001": {
    pin: "1234",
    user: {
      id: "u1",
      name: "Okafor Emmanuel",
      badgeNumber: "FO-001",
      role: "field_officer",
      sector: "Abuja FCT",
      station: "Kubwa Outpost",
      phone: "+234 803 111 2222",
    },
  },
  "SV-042": {
    pin: "1234",
    user: {
      id: "u2",
      name: "Adaeze Nwosu",
      badgeNumber: "SV-042",
      role: "supervisor",
      sector: "Abuja FCT",
      station: "FCT Sector Command",
      phone: "+234 805 333 4444",
    },
  },
  "CMD-007": {
    pin: "1234",
    user: {
      id: "u3",
      name: "Brig. Usman Aliyu",
      badgeNumber: "CMD-007",
      role: "commander",
      sector: "North Central Zone",
      station: "Zonal Command HQ",
      phone: "+234 809 555 6666",
    },
  },
};

const AUTH_STORAGE_KEY = "@frsc_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  async function loadStoredUser() {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function login(badgeNumber: string, pin: string): Promise<boolean> {
    const entry = DEMO_USERS[badgeNumber.toUpperCase()];
    if (!entry || entry.pin !== pin) return false;
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(entry.user));
    setUser(entry.user);
    return true;
  }

  async function logout() {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
