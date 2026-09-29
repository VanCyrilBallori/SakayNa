import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "./BrandLogo";
import { FIRESTORE_COLLECTIONS, TERMS_URL } from "../constants/app";
import { COLORS, LIGHT_COLORS } from "../constants/design";
import { auth, db } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../lib/session";

// Google's official "G" logo, cut from Google's sign-in button files. Do not recolor or stretch it.
const GOOGLE_G_LOGO = require("../assets/images/google-g.png");

// Faint city skyline behind the phone and van: [left, width, height] in the 320-wide drawing.
const BUILDINGS = [
  [0, 34, 70],
  [30, 28, 112],
  [62, 40, 84],
  [104, 30, 142],
  [138, 46, 96],
  [188, 26, 126],
  [218, 42, 78],
  [262, 30, 132],
  [292, 28, 88],
];
const GROUND_Y = 200;

export default function MobileLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colors = LIGHT_COLORS;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // The sheet always takes half of the screen.
  const sheetHeight = height * 0.5;
  // How far the sheet has been dragged down from its open position (0 = fully open).
  const [dragY] = useState(() => new Animated.Value(0));

  // Watches a finger on the sheet's top part (grey bar + title) and moves the sheet with it.
  const sheetDrag = useMemo(() => {
    const springBack = () => {
      Animated.spring(dragY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Math.max(0, ...) stops the sheet from going higher than its open position.
      onPanResponderMove: (event, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (event, gesture) => {
        // Dragged down more than a third of the sheet, or flicked down fast: close it.
        if (gesture.dy > sheetHeight * 0.33 || gesture.vy > 1) {
          Animated.timing(dragY, { toValue: sheetHeight, duration: 180, useNativeDriver: true }).start(() => setSheetOpen(false));
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    });
  }, [dragY, sheetHeight]);

  // The illustration is drawn on a 320 x 230 grid and scaled to fit small and large phones.
  const scale = Math.min((width - 48) / 320, (height * 0.36) / 230, 1.2);
  const u = (value) => value * scale;
  const logoSize = Math.min(96, height * 0.12);

  const openTerms = () => {
    WebBrowser.openBrowserAsync(TERMS_URL).catch((error) => console.log("Terms page warning:", error));
  };

  // 1. Google shows the account picker and gives us an ID token (a signed note: "this is juan@gmail.com").
  // 2. Firebase checks that note and logs the user in, so Firestore knows who they are.
  // 3. If they already have a SakayNa profile, index.jsx sends them to their home screen.
  const signInWithGoogle = async () => {
    if (googleBusy) return;

    setGoogleBusy(true);
    try {
      GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // The user closed the account picker.

      // Firebase keeps the login from here on. Forgetting the Google side makes the picker show again next time.
      await GoogleSignin.signOut();
      const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(response.data.idToken));

      const userDoc = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid));
      const profile = userDoc.exists() ? userDoc.data() : null;

      // New Google user: stay signed in and choose Resident or Driver, then fill in the form.
      if (!profile) {
        setSheetOpen(false);
        router.push("/choose-role");
        return;
      }

      // Same check as the email login: disabled, pending, or unknown-role accounts may not go in.
      if (!getPostAuthenticationRoute(profile)) {
        await logoutCurrentUser();
        Alert.alert("Account unavailable", "Your account is unavailable or has an invalid role. Please contact SakayNa support.");
      }
    } catch (error) {
      console.log("Google sign-in failed:", error);
      if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) return;
      const message =
        isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
          ? "Google Play services is missing or out of date on this phone."
          : getAuthErrorMessage(error, "Google sign-in did not work. Please try again, or use \"Log in with email\".");
      Alert.alert("Google sign-in", message);
    } finally {
      setGoogleBusy(false);
    }
  };

  const openSheet = () => {
    // Start fully open, even if the sheet was dragged closed last time.
    dragY.setValue(0);
    setSheetOpen(true);
  };

  const openEmailLogin = () => {
    setSheetOpen(false);
    router.push("/login");
  };

  const openChooseRole = async () => {
    setSheetOpen(false);
    // Someone who quit a Google sign-up halfway is still signed in, without a profile.
    // Sign them out first, so this email sign-up does not continue inside that Google account.
    if (auth.currentUser) {
      try {
        await logoutCurrentUser();
      } catch (error) {
        console.log("Sign-out before email sign-up failed:", error);
      }
    }
    router.push("/choose-role");
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      {/* Dark clock/battery icons so they stay visible on the white page, even when the phone is in dark mode. */}
      <StatusBar style="dark" />
      <View style={[styles.arcTop, { backgroundColor: colors.arc }]} />
      <View style={[styles.arcBottom, { backgroundColor: colors.arc }]} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[styles.logoDisc, { width: logoSize, height: logoSize, borderRadius: logoSize / 2 }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel="SakayNa"
        >
          <BrandLogo variant="secondary" height={logoSize * 0.56} style={styles.logoMark} />
        </View>

        <View style={styles.artArea}>
          <View
            style={{ width: u(320), height: u(230) }}
            accessible
            accessibilityRole="image"
            accessibilityLabel="A phone requesting a SakayNa van in Toledo City"
          >
            {BUILDINGS.map(([left, buildingWidth, buildingHeight]) => (
              <View
                key={left}
                style={{
                  position: "absolute",
                  left: u(left),
                  top: u(GROUND_Y - buildingHeight),
                  width: u(buildingWidth),
                  height: u(buildingHeight),
                  borderTopLeftRadius: u(3),
                  borderTopRightRadius: u(3),
                  backgroundColor: colors.building,
                }}
              />
            ))}

            <View
              style={{
                position: "absolute",
                left: u(20),
                top: u(GROUND_Y - 6),
                width: u(290),
                height: u(14),
                borderRadius: u(7),
                backgroundColor: colors.groundShadow,
              }}
            />

            {/* Phone showing a mini map and a pickup pin */}
            <View
              style={{
                position: "absolute",
                left: u(28),
                top: u(20),
                width: u(100),
                height: u(184),
                padding: u(5),
                borderRadius: u(18),
                backgroundColor: colors.phoneFrame,
              }}
            >
              <View style={{ flex: 1, borderRadius: u(14), overflow: "hidden", backgroundColor: colors.phoneScreen }}>
                <View style={{ height: u(18), justifyContent: "center", paddingHorizontal: u(7) }}>
                  <BrandLogo variant="secondary" height={u(10)} style={{ tintColor: colors.link }} />
                </View>

                <View style={{ height: u(88), marginHorizontal: u(5), borderRadius: u(8), overflow: "hidden", backgroundColor: colors.map }}>
                  <View style={[styles.road, { top: u(30), height: u(3), backgroundColor: colors.road, transform: [{ rotate: "-24deg" }] }]} />
                  <View style={[styles.road, { top: u(58), height: u(3), backgroundColor: colors.road, transform: [{ rotate: "18deg" }] }]} />
                  <View style={styles.mapCenter}>
                    <MaterialCommunityIcons name="map-marker" size={u(26)} color={colors.link} />
                    <Text allowFontScaling={false} style={{ fontSize: u(7), fontWeight: "700", color: colors.heading }}>
                      Toledo City
                    </Text>
                  </View>
                </View>

                <View style={{ marginHorizontal: u(7), marginTop: u(7) }}>
                  <Text allowFontScaling={false} style={{ fontSize: u(6), color: colors.muted }}>
                    Pickup
                  </Text>
                  <Text allowFontScaling={false} style={{ fontSize: u(7.5), fontWeight: "700", color: colors.heading }}>
                    Poblacion
                  </Text>
                </View>

                <View
                  style={{
                    height: u(16),
                    marginHorizontal: u(5),
                    marginTop: u(8),
                    borderRadius: u(8),
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: COLORS.primary,
                  }}
                >
                  <Text allowFontScaling={false} style={{ fontSize: u(6.5), fontWeight: "800", color: "#FFFFFF" }}>
                    Request a Ride
                  </Text>
                </View>
              </View>
            </View>

            {/* SakayNa van, wheels resting on the ground line */}
            <View style={{ position: "absolute", left: u(150), top: u(GROUND_Y - 119) }}>
              <MaterialCommunityIcons name="van-passenger" size={u(150)} color={colors.van} />
              <View
                style={{
                  position: "absolute",
                  left: u(62),
                  top: u(71),
                  width: u(26),
                  height: u(26),
                  borderRadius: u(13),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <BrandLogo variant="secondary" height={u(15)} style={{ tintColor: COLORS.primary }} />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.heading, { color: colors.heading }]}>Request a Ride now</Text>

          <Pressable
            style={styles.primaryButton}
            android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel="Get Started. Choose how to log in or create an account."
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFF" />
          </Pressable>

          <Pressable style={styles.textLink} onPress={() => router.push("/login")} accessibilityRole="link">
            <Text style={[styles.textLinkText, { color: colors.muted }]}>
              Already have an account? <Text style={[styles.linkStrong, { color: colors.link }]}>Log In</Text>
            </Text>
          </Pressable>

          <Pressable style={styles.termsLink} onPress={openTerms} accessibilityRole="link">
            <Text style={[styles.termsText, { color: colors.muted }]}>
              By continuing, you agree to SakayNa&apos;s{" "}
              <Text style={[styles.termsStrong, { color: colors.link }]}>Terms of Service</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Slide-up sheet: a layer on top of the page. Back button or tapping the dark area closes it. */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.backdrop }]}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setSheetOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />

          <Animated.View
            style={[styles.sheet, { height: sheetHeight, backgroundColor: colors.card, transform: [{ translateY: dragY }] }]}
          >
            {/* Drag area: the finger grabs the sheet here. It is kept out of the scroll list below so they don't fight. */}
            <View style={styles.sheetGrabArea} {...sheetDrag.panHandlers}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.handle }]} />

              <Text style={[styles.sheetTitle, { color: colors.heading }]} accessibilityRole="header">
                Let&apos;s Continue with
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>
                Select an Option to Log in or Create an Account
              </Text>
            </View>

            {/* Scrolls when the buttons don't fit in half the screen (for example with large text). */}
            {/* The bottom padding keeps the last button above Android's navigation bar. */}
            <ScrollView
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.sheetOptions}>
                <SheetOption
                  image={GOOGLE_G_LOGO}
                  label={googleBusy ? "Signing in..." : "Continue with Google"}
                  colors={colors}
                  onPress={signInWithGoogle}
                />

                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: colors.line }]} />
                  <Text style={[styles.orText, { color: colors.muted }]}>or</Text>
                  <View style={[styles.orLine, { backgroundColor: colors.line }]} />
                </View>

                <SheetOption icon="email-outline" label="Sign up with Email" colors={colors} onPress={openChooseRole} />
              </View>

              <Pressable style={styles.emailLink} onPress={openEmailLogin} accessibilityRole="link">
                <Text style={[styles.emailLinkText, { color: colors.muted }]}>
                  Already have an account? <Text style={[styles.linkStrong, { color: colors.link }]}>Log in with email</Text>
                </Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// One row button in the sheet.
// "image" shows a picture (like Google's colored G) instead of a one-color icon.
function SheetOption({ icon, image, label, colors, onPress }) {
  return (
    <Pressable
      style={[styles.option, { borderColor: colors.outline }]}
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {image ? (
        <Image source={image} style={styles.optionImage} accessibilityIgnoresInvertColors />
      ) : (
        <MaterialCommunityIcons name={icon} size={26} color={colors.heading} />
      )}
      <Text style={[styles.optionText, { color: colors.heading }]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  arcTop: { position: "absolute", top: -190, left: -150, width: 300, height: 300, borderRadius: 150 },
  arcBottom: { position: "absolute", bottom: -130, right: -150, width: 280, height: 280, borderRadius: 140 },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 16 },
  logoDisc: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  logoMark: { tintColor: "#FFFFFF" },
  artArea: { flex: 1, width: "100%", minHeight: 160, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  road: { position: "absolute", left: -20, right: -20 },
  mapCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heading: { fontSize: 26, lineHeight: 32, fontWeight: "800", textAlign: "center" },
  primaryButton: {
    minHeight: 56,
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  textLink: { minHeight: 48, marginTop: 8, alignItems: "center", justifyContent: "center" },
  textLinkText: { fontSize: 15, textAlign: "center" },
  linkStrong: { fontWeight: "800" },
  termsLink: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  termsText: { fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  termsStrong: { fontWeight: "700", textDecorationLine: "underline" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end" },
  sheetDismissArea: { flex: 1 },
  sheet: { width: "100%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  sheetGrabArea: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  sheetContent: { paddingHorizontal: 24 },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, marginBottom: 16 },
  sheetTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", textAlign: "center" },
  sheetSubtitle: { marginTop: 6, fontSize: 15, lineHeight: 21, textAlign: "center" },
  sheetOptions: { gap: 10 },
  option: {
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  optionText: { flex: 1, fontSize: 17, fontWeight: "700" },
  // Same space as the 26-wide icons, so all labels line up. The G itself is 24 x 24.
  optionImage: { width: 24, height: 24, marginHorizontal: 1 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 15, fontWeight: "600" },
  emailLink: { minHeight: 48, marginTop: 4, alignItems: "center", justifyContent: "center" },
  emailLinkText: { fontSize: 15, textAlign: "center" },
});
