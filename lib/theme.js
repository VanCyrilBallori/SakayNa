import { createContext, useContext, useEffect, useMemo, useState } from "react";

const memoryStorage = new Map();
const THEME_STORAGE_KEY = "sakayna-theme-mode";

const getStorage = () => {
  const storage = globalThis?.localStorage;

  if (storage && typeof storage.getItem === "function" && typeof storage.setItem === "function") {
    return storage;
  }

  return {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      memoryStorage.set(key, value);
    },
  };
};

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
  themePillBg: "#EFF5F1",
  themePillText: "#234335",
  disabledButtonBg: "#CFD8D3",
  disabledButtonText: "#466157",
  emergencyCard: "#F6D4D4",
  transportCard: "#F5EECA",
  statusCard: "#D0E8DE",
};

const darkTheme = {
  mode: "Dark",
  page: "#111815",
  headerBg: "#18231E",
  headerBorder: "#2A3832",
  surface: "#1A2420",
  softSurface: "#1E2D27",
  softSurfaceBorder: "#31453D",
  surfaceMuted: "#22302A",
  emptySurface: "#1E2B25",
  border: "#31423B",
  text: "#F1F5F2",
  heading: "#F1F5F2",
  mutedText: "#B1C1BA",
  secondaryText: "#9CB0A8",
  subtleText: "#90A19A",
  accentText: "#D9E8E1",
  avatarBg: "#315344",
  avatarText: "#EAF7EF",
  inputBg: "#23312B",
  menuOverlay: "rgba(0,0,0,0.42)",
  modalOverlay: "rgba(0,0,0,0.5)",
  shadow: "#000000",
  themePillBg: "#2A3B34",
  themePillText: "#E7F3EC",
  disabledButtonBg: "#42524B",
  disabledButtonText: "#D3E0DA",
  emergencyCard: "#3A2022",
  transportCard: "#342F19",
  statusCard: "#1E3A30",
};

const ThemeContext = createContext({
  theme: lightTheme,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const savedMode = getStorage().getItem(THEME_STORAGE_KEY);
    return savedMode === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    getStorage().setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      theme: mode === "dark" ? darkTheme : lightTheme,
      toggleTheme: () => setMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
