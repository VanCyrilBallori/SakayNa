export const COLORS = Object.freeze({
  primary: "#06774B",
  primaryDark: "#0F6B4F",
  success: "#06774B",
  warning: "#9A6700",
  warningSurface: "#FFF3CD",
  emergency: "#B42318",
  emergencySurface: "#FDE8E7",
  text: "#17382E",
  mutedText: "#557166",
  subtleText: "#6B7D75",
  page: "#F5F7F6",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F6F3",
  border: "#DDE8E2",
  disabled: "#C7D3CD",
  disabledText: "#52655D",
});

// Always light on purpose: the landing page (MobileLanding) and Choose Role screen do not follow
// the phone's theme or the app's Dark / Light switch.
export const LIGHT_COLORS = Object.freeze({
  page: "#FFFFFF",
  arc: "rgba(6, 119, 75, 0.06)",
  card: "#F0F6F3",
  heading: "#17382E",
  muted: "#557166",
  link: "#06774B",
  building: "rgba(6, 119, 75, 0.08)",
  groundShadow: "rgba(23, 56, 46, 0.10)",
  phoneFrame: "#17382E",
  phoneScreen: "#F7FAF8",
  map: "#D5E9DF",
  road: "#FFFFFF",
  van: "#06774B",
  // Slide-up sheet
  backdrop: "rgba(0, 0, 0, 0.4)",
  handle: "rgba(23, 56, 46, 0.24)",
  line: "#DDE8E2",
  ripple: "rgba(6, 119, 75, 0.12)",
  // Edge of a light button: dark enough to see where the button starts and ends.
  outline: "#6B8A7D",
});

// The colors from DESIGN.md (the "Barangay Hall + route board" look). Screens move to these one piece at a time.
// Light only: they do not change with the Dark / Light switch.
export const DESIGN_COLORS = Object.freeze({
  hallGreen: "#0B7A4B", // main buttons, place strip, links
  hallGreenDeep: "#0B5A37", // pressed buttons, "Assigned" / "On the way"
  emergencyRed: "#B42318", // Emergency and "can't be undone" only. Red has white words.
  redTint: "#FCE9E7",
  sakayOrange: "#FF8A00", // highlights: bands, badges, destination dot. Orange has dark words (never white).
  orangeDeep: "#B34D00", // small orange words on white or peach only (e.g. a scheduled time)
  peachTint: "#FDECD3", // background of important info boxes
  paperWhite: "#FFFFFF",
  boardTint: "#EEF3F0",
  ink: "#14211C", // main text
  inkMuted: "#4A5C55", // secondary text
  controlOutline: "#6B8079", // edges of inputs and outline buttons
  placeholder: "#5E6E68",
  rule: "#C5D1CB", // thin divider lines only
});

export const SPACING = Object.freeze({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
export const RADIUS = Object.freeze({ sm: 8, md: 12, lg: 16, xl: 20, pill: 999 });
export const TYPE = Object.freeze({ label: 12, body: 14, bodyLarge: 16, title: 24, heading: 30 });

// ---- UI refresh tokens (DESIGN.md "Style", October 2026) ----

// Plus Jakarta Sans, one name per weight (Android picks the font by name, not by fontWeight).
// Loaded in app/_layout.jsx. Use these instead of fontWeight: Board/Emergency 800, Title 700,
// Label and buttons 600, Body 400, Small 500.
export const FONT = Object.freeze({
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
});

// Tonal scales. Brand colors keep their place: Hall Green = GREEN[600], Hall Green Deep = GREEN[800],
// Sakay Orange = ORANGE[500], Orange Deep = ORANGE[700], Peach Tint = ORANGE[100],
// Board Tint = NEUTRAL[100], Ink = NEUTRAL[900]. Orange 600-900: small words only, never large fills.
export const GREEN = Object.freeze({ 50: "#EAF6F0", 100: "#D2ECDF", 200: "#A6D8BF", 300: "#72C09B", 400: "#3FA474", 500: "#1A8C5B", 600: "#0B7A4B", 700: "#0A6A41", 800: "#0B5A37", 900: "#083F27" });
export const ORANGE = Object.freeze({ 50: "#FFF6EA", 100: "#FDECD3", 200: "#FFD7A3", 300: "#FFBE6B", 400: "#FFA43A", 500: "#FF8A00", 600: "#D96F00", 700: "#B34D00", 800: "#8A3A00", 900: "#5E2700" });
export const NEUTRAL = Object.freeze({ 0: "#FFFFFF", 50: "#F5F8F6", 100: "#EEF3F0", 200: "#DDE5E1", 300: "#C5D1CB", 400: "#93A39C", 500: "#6B8079", 600: "#5E6E68", 700: "#4A5C55", 800: "#2B3A34", 900: "#14211C" });
// Red is still only for emergencies and "can't be undone".
export const RED = Object.freeze({ 50: "#FCE9E7", 600: "#B42318", 700: "#8E1B12" });

// Corners: 8 small tags, 12 inputs, 16 cards and dialogs, 24 sheet tops and the Emergency button, pill for buttons and chips.
export const CORNER = Object.freeze({ small: 8, input: 12, card: 16, sheet: 24, pill: 999 });

// Soft shadows (React Native's boxShadow, phone and website). Level 1 cards, 2 floating things, 3 sheets and dialogs.
export const SHADOW = Object.freeze({
  level1: { boxShadow: "0 1px 3px rgba(20, 33, 28, 0.08), 0 1px 2px rgba(20, 33, 28, 0.04)" },
  level2: { boxShadow: "0 4px 12px rgba(20, 33, 28, 0.12)" },
  level3: { boxShadow: "0 -8px 24px rgba(20, 33, 28, 0.16)" },
});
