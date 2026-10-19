import { createContext, useContext } from "react";

import { GREEN, NEUTRAL, ORANGE, RED } from "../constants/design";

// The app is always light (DESIGN.md: "Theme: light only").
// Dark mode and the Dark / Light switch were removed on 2026-10-03; the old code is in git history.
// "mode" stays because a few admin screens still check it.
// Used by the Admin screens (and the driver's "Checking driver access..." line). The colors are the
// DESIGN.md "Style" scales (UI refresh, October 2026): off-white page, white cards, neutral edges and words.
const lightTheme = {
  mode: "Light",
  page: NEUTRAL[50],
  headerBg: NEUTRAL[0],
  headerBorder: NEUTRAL[200],
  surface: NEUTRAL[0],
  softSurface: GREEN[50],
  softSurfaceBorder: GREEN[100],
  surfaceMuted: NEUTRAL[100],
  emptySurface: NEUTRAL[50],
  border: NEUTRAL[200],
  text: NEUTRAL[900],
  heading: NEUTRAL[900],
  mutedText: NEUTRAL[700],
  secondaryText: NEUTRAL[700],
  // Placeholder words in inputs (neutral 600, DESIGN.md Style).
  subtleText: NEUTRAL[600],
  accentText: NEUTRAL[800],
  avatarBg: GREEN[100],
  avatarText: GREEN[800],
  inputBg: NEUTRAL[0],
  menuOverlay: "rgba(20, 33, 28, 0.18)",
  modalOverlay: "rgba(20, 33, 28, 0.55)",
  shadow: "#000000",
  // Disabled (DESIGN.md Style): neutral 200 fill with neutral 700 words.
  disabledButtonBg: NEUTRAL[200],
  disabledButtonText: NEUTRAL[700],
  emergencyCard: RED[50],
  transportCard: ORANGE[100],
  statusCard: GREEN[100],
};

// Made once, so screens are not redrawn for nothing.
const THEME_VALUE = { theme: lightTheme };
const ThemeContext = createContext(THEME_VALUE);

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={THEME_VALUE}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
