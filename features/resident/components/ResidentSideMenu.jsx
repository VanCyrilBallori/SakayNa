import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import { ACCOUNT_STATUSES } from "../../../constants/app";
import { COLORS } from "../../../constants/design";
import { startPhoneCall } from "../../../lib/phoneCall";
import { getAccountStatusLabel } from "../../../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../../../lib/session";
import { useTheme } from "../../../lib/theme";

// The ☰ menu on the resident home screen. It slides in from the left.
// Tapping the dark area, the X, or the phone's Back button closes it.
// officePhone = the city office number the admin saved (publicOfficePhone). It can be empty.
export default function ResidentSideMenu({ visible, onClose, name, profile, officePhone, onOpenHistory, onOpenProfile, onOpenSettings }) {
  const router = useRouter();
  const { theme } = useTheme();
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

  const logOut = async () => {
    try {
      await logoutCurrentUser();
      onClose();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Logout failed", getAuthErrorMessage(error, "We could not log you out. Please try again."));
    }
  };

  // Green dot = verified, yellow = waiting for an admin, red = not accepted.
  const status = profile?.accountStatus;
  const statusDotColor = status === ACCOUNT_STATUSES.REJECTED ? COLORS.emergency : status === ACCOUNT_STATUSES.PENDING ? "#D99A00" : "#1FA56B";

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
        <View style={[styles.backdrop, { backgroundColor: theme.modalOverlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />

          <Animated.View
            style={[styles.panel, { width: panelWidth, backgroundColor: theme.surface, shadowColor: theme.shadow, transform: [{ translateX: slideX }] }]}
            accessibilityViewIsModal
          >
            <ScrollView contentContainerStyle={[styles.panelContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} showsVerticalScrollIndicator={false}>
              <View style={styles.profileRow}>
                <ProfileAvatar name={name} size={56} backgroundColor={theme.avatarBg} color={theme.avatarText} />
                <View style={styles.profileCopy}>
                  <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={2}>
                    {name}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                    <Text style={[styles.statusText, { color: theme.mutedText }]}>{getAccountStatusLabel(profile) || "Resident"}</Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.closeButton, pressed && { backgroundColor: theme.surfaceMuted }]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                >
                  <MaterialCommunityIcons name="close" size={26} color={theme.mutedText} />
                </Pressable>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <MenuRow icon="clock-outline" label="Request History" theme={theme} onPress={() => go(onOpenHistory)} />
              <MenuRow icon="account-outline" label="Profile" theme={theme} onPress={() => go(onOpenProfile)} />
              <MenuRow icon="cog-outline" label="Settings" theme={theme} onPress={() => go(onOpenSettings)} />

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <MenuRow icon="phone-outline" label="Help / Contact office" theme={theme} onPress={() => go(() => setHelpOpen(true))} />
              <MenuRow icon="file-document-outline" label="Terms of Service" theme={theme} onPress={() => go(() => router.push("/terms"))} />
              <MenuRow icon="shield-lock-outline" label="Privacy Policy" theme={theme} onPress={() => go(() => router.push("/privacy"))} />

              {/* Pushes Log out to the bottom of the menu when there is room. */}
              <View style={styles.spacer} />

              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <MenuRow icon="logout" label="Log out" theme={theme} onPress={logOut} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={[styles.helpBackdrop, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.helpCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.helpTitle, { color: theme.text }]} accessibilityRole="header">
              Help / Contact office
            </Text>

            {officePhone ? (
              <>
                <Text style={[styles.helpText, { color: theme.mutedText }]}>Questions about your account or a ride? Call the office.</Text>
                <Text style={[styles.helpPhone, { color: theme.heading }]} selectable>
                  {officePhone}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
                  onPress={() => startPhoneCall(officePhone)}
                  android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
                  accessibilityRole="button"
                  accessibilityLabel={`Call the office at ${officePhone}`}
                >
                  <MaterialCommunityIcons name="phone" size={22} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Call the office</Text>
                </Pressable>
              </>
            ) : (
              <Text style={[styles.helpText, { color: theme.mutedText }]}>The office phone number is not available right now. Please try again later.</Text>
            )}

            {/* Same light colors in Light and Dark mode on purpose, so this line always stands out. */}
            <View style={styles.emergencyNote}>
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color={COLORS.emergency} />
              <Text style={styles.emergencyNoteText}>For life-threatening emergencies, call 911.</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.helpCloseButton, { borderColor: theme.border }, pressed && { backgroundColor: theme.surfaceMuted }]}
              onPress={() => setHelpOpen(false)}
              accessibilityRole="button"
            >
              <Text style={[styles.helpCloseText, { color: theme.text }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// One line in the menu: an icon and a label. The whole line can be tapped.
function MenuRow({ icon, label, theme, onPress }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceMuted }]} onPress={onPress} accessibilityRole="button">
      <MaterialCommunityIcons name={icon} size={26} color={theme.heading} />
      <Text style={[styles.rowText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
    elevation: 16,
  },
  panelContent: { flexGrow: 1 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 20, paddingRight: 8, paddingVertical: 12 },
  profileCopy: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "800", lineHeight: 26 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: "600" },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  divider: { height: 1, marginVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 18, minHeight: 58, paddingHorizontal: 20 },
  rowText: { flex: 1, fontSize: 18, fontWeight: "600" },
  spacer: { flexGrow: 1, minHeight: 16 },
  helpBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  helpCard: { width: "100%", maxWidth: 420, padding: 24, borderRadius: 20 },
  helpTitle: { fontSize: 22, fontWeight: "800" },
  helpText: { marginTop: 10, fontSize: 16, lineHeight: 23 },
  helpPhone: { marginTop: 16, fontSize: 28, fontWeight: "800", letterSpacing: 0.5 },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.primary,
  },
  callButtonPressed: { backgroundColor: COLORS.primaryDark },
  callButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  emergencyNote: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: COLORS.emergencySurface },
  emergencyNoteText: { flex: 1, color: "#7A1A12", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  helpCloseButton: { minHeight: 52, marginTop: 16, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  helpCloseText: { fontSize: 17, fontWeight: "700" },
});
