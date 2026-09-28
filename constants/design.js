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

// Always dark on purpose: the landing page (MobileLanding) and Choose Role screen do not follow
// the phone's or the app's theme.
export const DARK_COLORS = Object.freeze({
  page: "#111815",
  arc: "rgba(92, 201, 154, 0.08)",
  card: "#1A2420",
  heading: "#F1F5F2",
  muted: "#B1C1BA",
  link: "#5CC99A",
  building: "rgba(92, 201, 154, 0.12)",
  groundShadow: "rgba(0, 0, 0, 0.35)",
  phoneFrame: "#050807",
  phoneScreen: "#22302A",
  map: "#1E3A30",
  road: "#2E4A3F",
  van: "#5CC99A",
  // Slide-up sheet
  backdrop: "rgba(0, 0, 0, 0.6)",
  handle: "rgba(241, 245, 242, 0.24)",
  line: "rgba(241, 245, 242, 0.16)",
  ripple: "rgba(92, 201, 154, 0.16)",
  // Edge of a dark button: bright enough to see where the button starts and ends.
  outline: "rgba(241, 245, 242, 0.4)",
});

export const SPACING = Object.freeze({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
export const RADIUS = Object.freeze({ sm: 8, md: 12, lg: 16, xl: 20, pill: 999 });
export const TYPE = Object.freeze({ label: 12, body: 14, bodyLarge: 16, title: 24, heading: 30 });