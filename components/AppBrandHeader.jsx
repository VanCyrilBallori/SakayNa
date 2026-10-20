import { useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import BrandLogo from "./BrandLogo";
import ProfileAvatar from "./profile/ProfileAvatar";
import { CORNER, DESIGN_COLORS, FONT, GREEN, NEUTRAL, SHADOW } from "../constants/design";

// The dispatcher website's header: the SakayNa logo with the barangay under it, and the initials circle.
// Clicking the circle opens a small account menu (like Gmail's): initials, name, email, role · barangay, Log out.
// The menu closes when you click outside it or press Escape (the website's Modal calls onRequestClose on Escape).
// barangay = the profile's barangay, e.g. "Daanglungsod, Toledo City" (", Toledo City" is not shown).
// soundMuted / onToggleSound (optional): the "Sound on / Sound off" button for the emergency alert sound (Task 3.13b).
//   It sits in the account menu. While the sound is off, a small muted-speaker icon shows next to the circle, so a
//   muted page is hard to miss. Muting lasts until the page is reloaded. (The button doesn't "unlock" the browser's
//   sound: useAlertSound does that on any click on the page.)
export default function AppBrandHeader({ role = "Resident", name = "User", email = "", barangay = "", onLogoutPress = () => {}, soundMuted = false, onToggleSound }) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [menuOpen, setMenuOpen] = useState(false);
  // Where the menu card goes: just under the circle, lined up with its right edge. Measured when it opens,
  // because the red emergency strip (when it shows) pushes the header down.
  const avatarRef = useRef(null);
  const [menuSpot, setMenuSpot] = useState({ top: 72, right: 16 });
  const openMenu = () => {
    avatarRef.current?.measureInWindow?.((x, y, avatarWidth, avatarHeight) => {
      setMenuSpot({ top: y + avatarHeight + 8, right: Math.max(16, width - (x + avatarWidth)) });
    });
    setMenuOpen(true);
  };

  const barangayName = (barangay || "").replace(/,\s*Toledo City$/i, "").trim();
  // The account menu says "Barangay Daanglungsod" (under the logo it is only the name, see HeaderBrand).
  const barangayText = barangayName ? `Barangay ${barangayName}` : "Barangay not set";

  // Close the menu first, then log out (the page's own function goes to Log In first, then signs out).
  const logOut = () => {
    setMenuOpen(false);
    onLogoutPress();
  };

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <HeaderBrand barangay={barangay} compact={compact} />

      <View style={styles.rightWrap}>
        {onToggleSound && soundMuted ? (
          <View style={styles.mutedIcon} accessible accessibilityLabel="Alert sound is off">
            <MaterialCommunityIcons name="volume-off" size={20} color={DESIGN_COLORS.ink} />
          </View>
        ) : null}
        <Pressable
          ref={avatarRef}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarButtonPressed]}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Account menu for ${name}`}
        >
          <ProfileAvatar name={name} size={44} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        {/* Clicking anywhere outside the card closes the menu. */}
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close account menu" />
        <View style={[styles.menuCard, menuSpot]} accessibilityViewIsModal>
          <ProfileAvatar name={name} size={64} />
          <Text style={styles.menuName} numberOfLines={1}>
            {name}
          </Text>
          {email ? (
            <Text style={styles.menuMuted} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          <Text style={styles.menuMuted} numberOfLines={1}>
            {role} · {barangayText}
          </Text>
          <View style={styles.menuRule} />
          {/* The menu stays open after a tap, so the dispatcher sees the new state. */}
          {onToggleSound ? (
            <Pressable
              style={({ pressed }) => [styles.soundButton, soundMuted && styles.soundButtonOff, pressed && styles.soundButtonPressed]}
              onPress={onToggleSound}
              accessibilityRole="button"
              accessibilityLabel={soundMuted ? "Alert sound is off. Turn it on" : "Alert sound is on. Turn it off"}
            >
              <MaterialCommunityIcons name={soundMuted ? "volume-off" : "volume-high"} size={22} color={soundMuted ? DESIGN_COLORS.ink : DESIGN_COLORS.inkMuted} />
              <Text style={[styles.soundText, soundMuted && styles.soundTextOff]}>{soundMuted ? "Sound off" : "Sound on"}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            onPress={logOut}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// The title at the left of the website headers: the icon, "SakayNa", and the barangay name under it.
// Shared by the dispatcher header (above) and the Admin header (app/admin-home.jsx), so both always look the same.
// barangay = the profile's barangay, e.g. "Daanglungsod, Toledo City": only "Daanglungsod" is shown (no repeated Toledo City).
// The logo picture "Logo (main)" has the word SakayNa inside it, so the barangay can't sit under the word.
// Instead: the icon alone ("secondary" logo), and next to it a text column with "SakayNa" and, right under it,
// the barangay name, both left-aligned and centered beside the icon.
export function HeaderBrand({ barangay = "", compact = false }) {
  const barangayName = (barangay || "").replace(/,\s*Toledo City$/i, "").trim();
  return (
    <View style={styles.brandWrap}>
      <BrandLogo variant="secondary" height={compact ? 36 : 44} accessible={false} />
      <View style={styles.brandText}>
        {/* Written like the logo: "Sakay" in the logo's own green, "Na" in black, bold italic.
            The logo's exact lettering is a font the app doesn't load, so this uses the system's bold italic. */}
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact]} accessibilityRole="header">
          <Text style={styles.wordmarkSakay}>Sakay</Text>
          <Text style={styles.wordmarkNa}>Na</Text>
        </Text>
        <Text style={styles.barangay} numberOfLines={1}>
          {barangayName || "Barangay not set"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // White with a thin line under it. Paddings unchanged: the dispatcher page's layout counts on this height (HEADER_HEIGHT).
  header: { width: "100%", paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: NEUTRAL[200], backgroundColor: NEUTRAL[0], flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
  headerCompact: { paddingHorizontal: 16, paddingVertical: 10 },
  // Icon on the left, then the text column (SakayNa over the barangay), centered beside the icon.
  brandWrap: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  brandText: { flexShrink: 1, alignItems: "flex-start" },
  // Tight line heights: no extra space under the text.
  wordmark: { fontSize: 26, lineHeight: 30, fontFamily: FONT.extraBold, fontStyle: "italic" },
  wordmarkCompact: { fontSize: 22, lineHeight: 26 },
  wordmarkSakay: { color: "#3B6255" }, // the logo's own green (DESIGN.md: the logo keeps its own green)
  wordmarkNa: { color: "#111111" },
  // The barangay name: small (15) and quiet (lighter gray-green, still 4.9:1 on white), so "SakayNa" stands out.
  barangay: { fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  rightWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  // The small muted-speaker icon next to the circle while the sound is off: orange edge on peach, like "Sound off".
  mutedIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: DESIGN_COLORS.sakayOrange, backgroundColor: DESIGN_COLORS.peachTint, alignItems: "center", justifyContent: "center" },
  // In the menu, above Log out. Sound on: quiet (no edge, muted words). Sound off: orange edge on peach, dark bold
  // words (Task 3.13b). A pill (DESIGN.md Style).
  soundButton: { alignSelf: "stretch", marginBottom: 8, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, borderRadius: CORNER.pill, borderWidth: 2, borderColor: "transparent" },
  soundButtonOff: { borderColor: DESIGN_COLORS.sakayOrange, backgroundColor: DESIGN_COLORS.peachTint },
  soundButtonPressed: { opacity: 0.75 },
  soundText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: DESIGN_COLORS.inkMuted },
  soundTextOff: { fontFamily: FONT.extraBold, color: DESIGN_COLORS.ink },
  // 48 x 48 tap area around the 44 circle.
  avatarButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarButtonPressed: { opacity: 0.75 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  // The small menu card under the circle (top and right are set in the code). A menu (DESIGN.md Style):
  // white, 16 corners, a thin edge and a Level 2 shadow.
  menuCard: {
    position: "absolute",
    width: 300,
    maxWidth: "92%",
    alignItems: "center",
    padding: 20,
    gap: 4,
    borderRadius: CORNER.card,
    borderWidth: 1,
    borderColor: NEUTRAL[200],
    backgroundColor: NEUTRAL[0],
    ...SHADOW.level2,
  },
  menuName: { marginTop: 10, maxWidth: "100%", fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: NEUTRAL[900] },
  menuMuted: { fontFamily: FONT.regular, maxWidth: "100%", fontSize: 15, lineHeight: 20, color: NEUTRAL[700] },
  menuRule: { alignSelf: "stretch", height: 1, marginVertical: 12, backgroundColor: NEUTRAL[200] },
  // Log out: a secondary pill (white, grey edge, green words).
  logoutButton: { alignSelf: "stretch", minHeight: 48, borderRadius: CORNER.pill, borderWidth: 1.5, borderColor: NEUTRAL[500], alignItems: "center", justifyContent: "center" },
  logoutButtonPressed: { backgroundColor: NEUTRAL[100] },
  logoutText: { fontSize: 17, fontFamily: FONT.semiBold, color: GREEN[700] },
});
