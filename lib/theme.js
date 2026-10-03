import { createContext, useContext } from "react";

// The app is always light (DESIGN.md: "Theme: light only").
// Dark mode and the Dark / Light switch were removed on 2026-10-03; the old code is in git history.
// "mode" stays because a few admin screens still check it.
const lightTheme = {
  mode: "Light",
  page: "#F5F7F6",
  headerBg: "#FFFFFF",
  headerBorder: "#D8E2DD",
  surface: "#FFFFFF",
  softSurface: "#E6F1EB",
  softSurfaceBorder: "#D6E6DD",
  surfaceMuted: "#EEF2F0",
  emptySurface: "#F4F7F5",
  border: "#DCE5E0",
  text: "#111111",
  heading: "#1C3E31",
  mutedText: "#4F655C",
  secondaryText: "#5B6D66",
  subtleText: "#8B8B8B",
  accentText: "#304941",
  avatarBg: "#D8EBDD",
  avatarText: "#184534",
  inputBg: "#FCFCFC",
  menuOverlay: "rgba(0,0,0,0.18)",
  modalOverlay: "rgba(0,0,0,0.28)",
  shadow: "#000000",
  disabledButtonBg: "#CFD8D3",
  disabledButtonText: "#466157",
  emergencyCard: "#F6D4D4",
  transportCard: "#F5EECA",
  statusCard: "#D0E8DE",
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
