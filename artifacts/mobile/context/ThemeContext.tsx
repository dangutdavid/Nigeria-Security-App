import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

const THEME_KEY = "@frsc_theme_preference";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === "light" || value === "dark") setOverride(value);
      setLoaded(true);
    });
  }, []);

  const theme = override ?? (systemScheme === "dark" ? "dark" : "light");
  const isDark = theme === "dark";

  const toggleTheme = useMemo(
    () => () => {
      const next: ThemeMode = isDark ? "light" : "dark";
      setOverride(next);
      AsyncStorage.setItem(THEME_KEY, next);
    },
    [isDark]
  );

  if (!loaded) return <>{children}</>;

  return <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
