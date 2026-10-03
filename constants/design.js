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
  sakayOrange: "#F97316", // highlights: bands, badges, destination dot. Orange has dark words (never white).
  orangeDeep: "#B34D00", // small orange words on white or peach only (e.g. a scheduled time)
  peachTint: "#FDECD3", // background of important info boxes
  waitingAmber: "#8A5A00", // OLD: being replaced by sakayOrange / orangeDeep (color update Step 2)
  amberTint: "#FFF4D6", // OLD: being replaced by peachTint (color update Step 2)
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