import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { endDutyOnApi, startDutyOnApi } from "@/services/dutyRepository";

export type PatrolStatus = "off_duty" | "on_duty" | "on_break";

export interface PatrolEncounter {
  id: string;
  timestamp: string;
  type: "vehicle_check" | "incident" | "note" | "checkpoint";
  description: string;
  plate?: string;
  location?: string;
}

export interface PatrolSession {
  id: string;
  officerId: string;
  officerName: string;
  officerBadge: string;
  startTime: string;
  endTime?: string;
  status: PatrolStatus;
  route: string;
  encounters: PatrolEncounter[];
  totalKm?: number;
  notes: string;
  /** Backend duty-session id when the start was mirrored to the API. */
  serverSessionId?: string;
}

interface PatrolContextType {
  activeSession: PatrolSession | null;
  sessions: PatrolSession[];
  startDuty: (officerId: string, officerName: string, officerBadge: string, route: string) => Promise<void>;
  endDuty: (notes: string, totalKm?: number) => Promise<void>;
  setBreak: (onBreak: boolean) => Promise<void>;
  addEncounter: (encounter: Omit<PatrolEncounter, "id" | "timestamp">) => Promise<void>;
  isOnDuty: boolean;
}

const PatrolContext = createContext<PatrolContextType>({
  activeSession: null,
  sessions: [],
  startDuty: async () => {},
  endDuty: async () => {},
  setBreak: async () => {},
  addEncounter: async () => {},
  isOnDuty: false,
});

const PATROL_STORAGE_KEY = "@frsc_patrol_sessions";
const ACTIVE_PATROL_KEY = "@frsc_active_patrol";

export function PatrolProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<PatrolSession[]>([]);
  const [activeSession, setActiveSession] = useState<PatrolSession | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [storedSessions, storedActive] = await Promise.all([
        AsyncStorage.getItem(PATROL_STORAGE_KEY),
        AsyncStorage.getItem(ACTIVE_PATROL_KEY),
      ]);
      if (storedSessions) setSessions(JSON.parse(storedSessions));
      if (storedActive) setActiveSession(JSON.parse(storedActive));
    } catch {
      // ignore
    }
  }

  async function persistSessions(next: PatrolSession[]) {
    setSessions(next);
    await AsyncStorage.setItem(PATROL_STORAGE_KEY, JSON.stringify(next));
  }

  async function persistActive(session: PatrolSession | null) {
    setActiveSession(session);
    if (session) {
      await AsyncStorage.setItem(ACTIVE_PATROL_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(ACTIVE_PATROL_KEY);
    }
  }

  async function startDuty(
    officerId: string,
    officerName: string,
    officerBadge: string,
    route: string
  ) {
    const session: PatrolSession = {
      id: `P${Date.now()}`,
      officerId,
      officerName,
      officerBadge,
      startTime: new Date().toISOString(),
      status: "on_duty",
      route,
      encounters: [],
      notes: "",
    };
    // Mirror to the backend duty-session API (best-effort; local stays
    // authoritative for the UI).
    const serverSessionId = await startDutyOnApi(route);
    if (serverSessionId) session.serverSessionId = serverSessionId;
    await persistActive(session);
  }

  async function endDuty(notes: string, totalKm?: number) {
    if (!activeSession) return;
    const ended: PatrolSession = {
      ...activeSession,
      endTime: new Date().toISOString(),
      status: "off_duty",
      notes,
      totalKm,
    };
    if (ended.serverSessionId) {
      void endDutyOnApi(ended.serverSessionId, [
        ...ended.encounters.map((e) => ({ ...e })),
        { note: notes, totalKm: totalKm ?? null, endedAt: ended.endTime },
      ]);
    }
    await persistSessions([ended, ...sessions]);
    await persistActive(null);
  }

  async function setBreak(onBreak: boolean) {
    if (!activeSession) return;
    const updated: PatrolSession = {
      ...activeSession,
      status: onBreak ? "on_break" : "on_duty",
    };
    await persistActive(updated);
  }

  async function addEncounter(
    encounter: Omit<PatrolEncounter, "id" | "timestamp">
  ) {
    if (!activeSession) return;
    const newEncounter: PatrolEncounter = {
      ...encounter,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    const updated: PatrolSession = {
      ...activeSession,
      encounters: [...activeSession.encounters, newEncounter],
    };
    await persistActive(updated);
  }

  return (
    <PatrolContext.Provider
      value={{
        activeSession,
        sessions,
        startDuty,
        endDuty,
        setBreak,
        addEncounter,
        isOnDuty: activeSession?.status === "on_duty" || activeSession?.status === "on_break",
      }}
    >
      {children}
    </PatrolContext.Provider>
  );
}

export function usePatrol() {
  return useContext(PatrolContext);
}
