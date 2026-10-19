import { useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import BrandLogo from "./BrandLogo";
import ProfileAvatar from "./profile/ProfileAvatar";
import { COLORS, DESIGN_COLORS, FONT } from "../constants/design";

// The dispatcher website's header: the SakayNa logo with the barangay under it, and the initials circle.
// Clicking the circle opens a small account menu (like Gmail's): initials, name, email, role · barangay, Log out.
// The menu closes when you click outside it or press Escape (the website's Modal calls onRequestClose on Escape).
// barangay = the profile's barangay, e.g. "Daanglungsod, Toledo City" (", Toledo City" is not shown).
// soundMuted / onToggleSound (optional): the "Sound on / Sound off" button for the emergency alert sound (Task 3.13b).
//   "Sound off" is shown in orange so a muted page is hard to miss. Muting lasts until the page is reloaded.
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
  // Under the logo: only the name ("Daanglungsod"). The account menu still says "Barangay Daanglungsod".
  const barangayText = barangayName ? `Barangay ${barangayName}` : "Barangay not set";

  // Close the menu first, then log out (the page's own function goes to Log In first, then signs out).
  const logOut = () => {
    setMenuOpen(false);
    onLogoutPress();
  };

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {/* The logo picture "Logo (main)" has the word SakayNa inside it, so the barangay can't sit under the word.
          Instead: the icon alone ("secondary" logo), and next to it a text column with "SakayNa" and, right under it,
          the barangay name, both left-aligned and centered beside the icon. */}
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

      <View style={styles.rightWrap}>
        {onToggleSound ? (
          <Pressable
            style={({ pressed }) => [styles.soundButton, soundMuted && styles.soundButtonOff, pressed && styles.soundButtonPressed]}
            onPress={onToggleSound}
            accessibilityRole="button"
            accessibilityLabel={soundMuted ? "Alert sound is off. Turn it on" : "Alert sound is on. Turn it off"}
          >
            <MaterialCommunityIcons name={soundMuted ? "bell-off-outline" : "bell-outline"} size={22} color={soundMuted ? DESIGN_COLORS.ink : DESIGN_COLORS.inkMuted} />
            <Text style={[styles.soundText, soundMuted && styles.soundTextOff]}>{soundMuted ? "Sound off" : "Sound on"}</Text>
          </Pressable>
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

const styles = StyleSheet.create({
  header: { width: "100%", paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#D7E2DC", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
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
  barangay: { fontSize: 15, lineHeight: 20, fontFamily: FONT.regular, color: "#647570" },
  rightWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  // Sound on: quiet (no edge, muted words). Sound off: orange edge on peach, dark bold words (Task 3.13b).
  soundButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  soundButtonOff: { borderColor: DESIGN_COLORS.sakayOrange, backgroundColor: DESIGN_COLORS.peachTint },
  soundButtonPressed: { opacity: 0.75 },
  soundText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: DESIGN_COLORS.inkMuted },
  soundTextOff: { fontFamily: FONT.extraBold, color: DESIGN_COLORS.ink },
  // 48 x 48 tap area around the 44 circle.
  avatarButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarButtonPressed: { opacity: 0.75 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  // The small card under the circle (top and right are set in the code).
  menuCard: {
    position: "absolute",
    width: 300,
    maxWidth: "92%",
    alignItems: "center",
    padding: 20,
    gap: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D7E2DC",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuName: { marginTop: 10, maxWidth: "100%", fontSize: 18, lineHeight: 24, fontFamily: FONT.extraBold, color: "#111111" },
  menuMuted: { fontFamily: FONT.regular, maxWidth: "100%", fontSize: 15, lineHeight: 20, color: "#4F655C" },
  menuRule: { alignSelf: "stretch", height: 1, marginVertical: 12, backgroundColor: "#D7E2DC" },
  logoutButton: { alignSelf: "stretch", minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  logoutButtonPressed: { backgroundColor: "#E5F4ED" },
  logoutText: { fontSize: 17, fontFamily: FONT.bold, color: COLORS.primary },
});
