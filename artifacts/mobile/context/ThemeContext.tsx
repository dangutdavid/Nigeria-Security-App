import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

const THEME_KEY = "@frsc_theme_preference";

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  isManualOverride: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
  isManualOverride: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<"light" | "dark" | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "light" || val === "dark") setOverride(val);
      setLoaded(true);
    });
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setOverride(next);
    AsyncStorage.setItem(THEME_KEY, next);
  }

  const isDark = override !== null ? override === "dark" : systemScheme === "dark";
  const isManualOverride = override !== null;

  if (!loaded) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, isManualOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
