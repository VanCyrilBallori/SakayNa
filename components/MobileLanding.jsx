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
  Easing,
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
import { DESIGN_COLORS, LIGHT_COLORS } from "../constants/design";
import { auth, db } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../lib/session";

// Google's official "G" logo, cut from Google's sign-in button files. Do not recolor or stretch it.
const GOOGLE_G_LOGO = require("../assets/images/google-g.png");

export default function MobileLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // The Get Started sheet still uses the older LIGHT_COLORS (shared with other screens) until it is redesigned too.
  const colors = LIGHT_COLORS;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // The sheet always takes half of the screen.
  const sheetHeight = height * 0.5;
  // How far the sheet is pushed down from its open position (0 = fully open, sheetHeight = hidden below the screen).
  // It moves when the sheet slides in, slides out, or is dragged.
  const [dragY] = useState(() => new Animated.Value(0));
  // The dark background follows the sheet: fully dark when the sheet is open, invisible when it is hidden.
  // So when the sheet slides, the background fades instead of sliding with it.
  const backdropOpacity = dragY.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0], extrapolate: "clamp" });

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

  // The wide SakayNa logo: 240 wide, smaller on narrow phones.
  const logoWidth = Math.min(240, width - 64);

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
    // Start hidden below the screen. slideSheetIn moves it up once the sheet is on the screen.
    dragY.setValue(sheetHeight);
    setSheetOpen(true);
  };

  const slideSheetIn = () => {
    Animated.timing(dragY, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  // Slide the sheet down (the background fades with it), and remove it only after that.
  // "finished" is false when the slide was interrupted (for example by a second tap), so we don't remove it twice.
  const closeSheet = () => {
    Animated.timing(dragY, { toValue: sheetHeight, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setSheetOpen(false);
    });
  };

  const openEmailLogin = () => {
    setSheetOpen(false);
    router.push("/login");
  };

  // Email sign-up: Create Account → Verify Your Email → Choose Role → form.
  const openEmailSignup = async () => {
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
    router.push("/signup");
  };

  return (
    <View style={styles.page}>
      {/* Dark clock/battery icons so they stay visible on the white page, even when the phone is in dark mode. */}
      <StatusBar style="dark" />

      {/* DESIGN.md look: a barangay signboard, not a ride-hailing poster. Scrolls on small phones and with big text. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.column}>
          {/* The service named in words: the wide SakayNa logo. */}
          <BrandLogo variant="main" width={logoWidth} style={styles.logo} accessible accessibilityRole="image" accessibilityLabel="SakayNa" />
          <Text style={styles.purpose}>Transport and emergency help for Toledo City</Text>

          {/* Route board (DESIGN.md): a painted sign, like a jeepney signboard. It is NOT a button or a text box: */}
          {/* no arrows, no box edges, nothing happens when you tap it. TalkBack reads it as one sentence. */}
          <View style={styles.routeBoard} accessible accessibilityLabel="From your barangay to where you need to go.">
            <View style={styles.routeLine}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routePlace}>Your barangay</Text>
            </View>
            <View style={styles.routeJoin} />
            <View style={styles.routeLine}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routePlace}>Where you need to go</Text>
            </View>
          </View>

          <View style={styles.vehicleLine}>
            <MaterialCommunityIcons name="van-passenger" size={30} color={DESIGN_COLORS.hallGreen} />
            <Text style={styles.vehicleText}>Barangay vehicles, sent by a dispatcher.</Text>
          </View>

          {/* Pushes the buttons down to the thumb when there is room. */}
          <View style={styles.spacer} />

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel="Get Started. Choose how to log in or create an account."
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <MaterialCommunityIcons name="arrow-right" size={24} color="#FFFFFF" />
          </Pressable>

          <Pressable style={styles.textLink} onPress={() => router.push("/login")} accessibilityRole="link">
            <Text style={styles.textLinkText}>
              Already have an account? <Text style={styles.linkStrong}>Log In</Text>
            </Text>
          </Pressable>

          <Pressable style={styles.termsLink} onPress={openTerms} accessibilityRole="link">
            <Text style={styles.termsText}>
              By continuing, you agree to SakayNa&apos;s <Text style={styles.termsStrong}>Terms of Service</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Slide-up sheet: a layer on top of the page. Back button or tapping the dark area closes it. */}
      {/* animationType="none": we move the sheet and fade the background ourselves (dragY above). */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onShow={slideSheetIn}
        onRequestClose={closeSheet}
      >
        <View style={styles.sheetBackdrop}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop, opacity: backdropOpacity }]} pointerEvents="none" />
          <Pressable
            style={styles.sheetDismissArea}
            onPress={closeSheet}
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

                <SheetOption icon="email-outline" label="Sign up with Email" colors={colors} onPress={openEmailSignup} />
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
  page: { flex: 1, backgroundColor: DESIGN_COLORS.paperWhite },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 16 },
  column: { flex: 1, width: "100%", maxWidth: 480 },
  logo: { alignSelf: "center" },
  purpose: { marginTop: 12, fontSize: 17, lineHeight: 24, fontWeight: "500", color: DESIGN_COLORS.inkMuted, textAlign: "center" },
  // Route board: a solid Hall Green sign with white letters (6.85:1). 8 corners, flat.
  routeBoard: { marginTop: 28, paddingHorizontal: 20, paddingVertical: 20, borderRadius: 8, backgroundColor: DESIGN_COLORS.hallGreen },
  routeLine: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  routeLabel: { width: 52, fontSize: 17, lineHeight: 22, fontWeight: "700", color: "#FFFFFF" },
  // "Board" size from DESIGN.md: the biggest text on the page.
  routePlace: { flex: 1, fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#FFFFFF" },
  // Short white line joining From and To, under the place names' left edge (label 52 + gap 12).
  routeJoin: { width: 2, height: 18, marginLeft: 66, marginVertical: 6, backgroundColor: "#FFFFFF" },
  vehicleLine: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, paddingHorizontal: 4 },
  vehicleText: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: "600", color: DESIGN_COLORS.ink },
  spacer: { flex: 1, minHeight: 24 },
  primaryButton: {
    minHeight: 56,
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  primaryButtonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  primaryButtonText: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: "#FFFFFF" },
  textLink: { minHeight: 48, marginTop: 8, alignItems: "center", justifyContent: "center" },
  textLinkText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted, textAlign: "center" },
  linkStrong: { fontWeight: "800", color: DESIGN_COLORS.hallGreen },
  termsLink: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  // 15 = the smallest text size in DESIGN.md (was 12.5).
  termsText: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted, textAlign: "center" },
  termsStrong: { fontWeight: "700", color: DESIGN_COLORS.hallGreen, textDecorationLine: "underline" },
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
