import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import CloseButton from "../../../components/ui/CloseButton";
import { ACCOUNT_STATUSES } from "../../../constants/app";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED, SHADOW } from "../../../constants/design";
import { startPhoneCall } from "../../../lib/phoneCall";
import { getAccountStatusLabel } from "../../../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../../../lib/session";

// The ☰ menu on the resident home screen. It slides in from the left.
// Tapping the dark area, the X, or the phone's Back button closes it.
// officePhone = the city office number the admin saved (publicOfficePhone). It can be empty.
// The driver home uses this menu too. It gives no onOpenHistory (no "Request History" row; Ride history is on
// the Availability page) and its own onLogOut, which saves "Offline" before signing out.
// onReopen = opens this menu again (the screen's setMenuOpen(true)): used when coming back from Terms or Privacy.
export default function ResidentSideMenu({ visible, onClose, onReopen, name, profile, officePhone, onOpenHistory, onOpenProfile, onOpenSettings, onLogOut }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [helpOpen, setHelpOpen] = useState(false);

  // The menu covers most of the screen but leaves a strip of the home screen showing on the right.
  const panelWidth = Math.min(340, width * 0.86);
  // How far the menu is pushed off the left edge (0 = fully open).
  const [slideX] = useState(() => new Animated.Value(-panelWidth));

  // Every time the menu opens, start it off-screen and slide it in.
  useEffect(() => {
    if (!visible) return;
    slideX.setValue(-panelWidth);
    Animated.timing(slideX, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, panelWidth, slideX]);

  // Close the menu first, then open the chosen screen.
  const go = (action) => {
    onClose();
    action();
  };

  // Website legal pages open separately; the phone app keeps its normal page navigation.
  // On the phone, closing Terms or Privacy brings back this menu (where they were opened), not the bare home page.
  const reopenOnReturnRef = useRef(false);
  const openLegalPage = (path) => {
    if (Platform.OS === "web") {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    reopenOnReturnRef.current = Boolean(onReopen);
    router.push(path);
  };
  // Runs each time the home screen is shown again (also the first time, when nothing was opened yet).
  useFocusEffect(
    useCallback(() => {
      if (!reopenOnReturnRef.current) return;
      reopenOnReturnRef.current = false;
      onReopen?.();
    }, [onReopen])
  );

  const logOut = async () => {
    if (onLogOut) {
      onClose();
      onLogOut();
      return;
    }
    try {
      // Go to Log In first, then sign out. Signing out first makes AuthRouteGate take the screens
      // away, and then the move to Log In has nothing to run in ("REPLACE ... not handled").
      onClose();
      router.replace("/login");
      await logoutCurrentUser();
    } catch (error) {
      Alert.alert("Logout failed", getAuthErrorMessage(error, "We could not log you out. Please try again."));
    }
  };

  // Green dot = verified (Active resident, Approved driver), orange = waiting for an admin, red = anything else
  // (Rejected, Suspended, ...). The status word is always next to the dot, so it is not color alone.
  const status = profile?.accountStatus;
  const statusDotColor = status === ACCOUNT_STATUSES.ACTIVE || status === ACCOUNT_STATUSES.APPROVED ? GREEN[500] : status === ACCOUNT_STATUSES.PENDING ? ORANGE[500] : RED[600];

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />

          {/* The panel starts just below the clock and battery (Task 3.17): the dark backdrop stays behind them,
              so their white icons can be seen (on the white panel they were invisible). */}
          <Animated.View style={[styles.panel, { top: insets.top, width: panelWidth, transform: [{ translateX: slideX }] }]} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={[styles.panelContent, { paddingTop: 12, paddingBottom: insets.bottom + 12 }]} showsVerticalScrollIndicator={false}>
              <View style={styles.profileRow}>
                {/* Tapping the picture opens Profile, the same as the Profile row below (Task 3.7). */}
                <Pressable
                  style={({ pressed }) => pressed && styles.avatarPressed}
                  onPress={() => go(onOpenProfile)}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                >
                  <ProfileAvatar name={name} size={56} backgroundColor={GREEN[100]} color={GREEN[800]} />
                </Pressable>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileName} numberOfLines={2}>
                    {name}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                    <Text style={styles.statusText}>{getAccountStatusLabel(profile) || "Resident"}</Text>
                  </View>
                </View>
                <CloseButton onPress={onClose} label="Close menu" style={styles.closeButton} />
              </View>

              <View style={styles.divider} />

              {onOpenHistory ? <MenuRow icon="history" label="Request History" onPress={() => go(onOpenHistory)} /> : null}
              <MenuRow icon="account-outline" label="Profile" onPress={() => go(onOpenProfile)} />
              <MenuRow icon="cog-outline" label="Settings" onPress={() => go(onOpenSettings)} />

              <View style={styles.divider} />

              <MenuRow icon="phone-outline" label="Help / Contact office" onPress={() => go(() => setHelpOpen(true))} />
              <MenuRow icon="file-document-outline" label="Terms of Service" onPress={() => go(() => openLegalPage("/terms"))} />
              <MenuRow icon="shield-lock-outline" label="Privacy Policy" onPress={() => go(() => openLegalPage("/privacy"))} />

              {/* Pushes Log out to the bottom of the menu when there is room. */}
              <View style={styles.spacer} />

              <View style={styles.divider} />
              <MenuRow icon="logout" label="Log out" onPress={logOut} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.helpBackdrop}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle} accessibilityRole="header">
              Help / Contact office
            </Text>

            {officePhone ? (
              <>
                <Text style={styles.helpText}>Questions about your account or a ride? Call the office.</Text>
                <Text style={styles.helpPhone} selectable>
                  {officePhone}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
                  onPress={() => startPhoneCall(officePhone)}
                  android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
                  accessibilityRole="button"
                  accessibilityLabel={`Call the office at ${officePhone}`}
                >
                  <MaterialCommunityIcons name="phone-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Call the office</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.helpText}>The office phone number is not available right now. Please try again later.</Text>
            )}

            {/* Red tint: this line must stand out. */}
            <View style={styles.emergencyNote}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color={RED[600]} />
              <Text style={styles.emergencyNoteText}>For life-threatening emergencies, call 911.</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.helpCloseButton, pressed && styles.helpCloseButtonPressed]}
              onPress={() => setHelpOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.helpCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// One line in the menu (DESIGN.md Style list row): an icon in a light green circle and a label. The whole line can be tapped.
function MenuRow({ icon, label, onPress }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} size={24} color={GREEN[700]} />
      </View>
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  // White panel, 16 corners on the right, a soft shadow to the right (DESIGN.md Style).
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderTopRightRadius: CORNER.card,
    borderBottomRightRadius: CORNER.card,
    overflow: "hidden",
    backgroundColor: NEUTRAL[0],
    boxShadow: "4px 0 24px rgba(20, 33, 28, 0.18)",
  },
  panelContent: { flexGrow: 1 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 20, paddingRight: 8, paddingVertical: 12 },
  avatarPressed: { opacity: 0.7 },
  profileCopy: { flex: 1 },
  profileName: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  statusDot: { width: 10, height: 10, borderRadius: CORNER.pill },
  statusText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  closeButton: { alignSelf: "flex-start" },
  divider: { height: 1, marginVertical: 8, marginHorizontal: 20, backgroundColor: NEUTRAL[200] },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 56, paddingHorizontal: 20, paddingVertical: 4 },
  rowPressed: { backgroundColor: NEUTRAL[100] },
  rowIcon: { width: 40, height: 40, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[50] },
  rowText: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  spacer: { flexGrow: 1, minHeight: 16 },
  helpBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  // A dialog (DESIGN.md Style): white, 16 corners, Level 3 shadow.
  helpCard: { width: "100%", maxWidth: 420, padding: 24, borderRadius: CORNER.card, backgroundColor: NEUTRAL[0], ...SHADOW.level3 },
  helpTitle: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  helpText: { marginTop: 8, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[700] },
  helpPhone: { marginTop: 16, fontSize: 28, lineHeight: 34, fontFamily: FONT.extraBold, letterSpacing: 0.5, color: NEUTRAL[900] },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 56,
    marginTop: 16,
    paddingHorizontal: 20,
    borderRadius: CORNER.pill,
    overflow: "hidden",
    backgroundColor: GREEN[600],
  },
  callButtonPressed: { backgroundColor: GREEN[800] },
  callButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: "#FFFFFF" },
  emergencyNote: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, padding: 14, borderRadius: CORNER.input, backgroundColor: RED[50] },
  emergencyNoteText: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: RED[700] },
  helpCloseButton: { minHeight: 48, marginTop: 16, borderRadius: CORNER.pill, borderWidth: 1.5, borderColor: NEUTRAL[500], alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL[0] },
  helpCloseButtonPressed: { backgroundColor: NEUTRAL[100] },
  helpCloseText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
});
