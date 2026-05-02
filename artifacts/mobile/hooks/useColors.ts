import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the active color scheme.
 * Respects the user's manual override from ThemeContext (profile toggle),
 * falling back to the system appearance setting.
 */
export function useColors() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
