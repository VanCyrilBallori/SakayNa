import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { CORNER, FONT, GREEN, NEUTRAL, SHADOW } from "../constants/design";
import { auth, db } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../lib/session";

// Google's official "G" logo, cut from Google's sign-in button files. Do not recolor or stretch it.
const GOOGLE_G_LOGO = require("../assets/images/google-g.png");

// The dark see-through layer behind the Get Started sheet, and the press ripple on its buttons (Hall Green, faint).
const BACKDROP_COLOR = "rgba(0, 0, 0, 0.4)";
const RIPPLE_COLOR = "rgba(11, 122, 75, 0.12)";

// AI-generated roadscape, with transparent margins trimmed and proportions preserved.
const LANDING_MIDDLE_IMAGE = require("../assets/images/landing-roadscape.png");
const LANDING_IMAGE_RATIO = 754 / 287;
const MIN_PICTURE_HEIGHT = 48;
const PICTURE_CARD_GAP = 2;

export default function MobileLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(height);
  const [cardHeight, setCardHeight] = useState(0);
  const landingScrollRef = useRef(null);
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

  const logoSize = Math.min(96, height * 0.12);
  const paddingTop = insets.top + 24;
  const paddingBottom = insets.bottom + 16;

  // Reserve 16dp below the logo and 2dp above the card. The picture keeps its trimmed proportions.
  const pictureSpacing = 16 + PICTURE_CARD_GAP;
  const remainingPictureSpace = viewportHeight - paddingTop - paddingBottom - logoSize - cardHeight;
  const availablePictureHeight = cardHeight > 0 ? Math.max(MIN_PICTURE_HEIGHT, remainingPictureSpace - pictureSpacing) : MIN_PICTURE_HEIGHT;
  const pictureWidth = Math.min(width - 32, 480, availablePictureHeight * LANDING_IMAGE_RATIO);
  const pictureHeight = pictureWidth / LANDING_IMAGE_RATIO;
  const spareLogoSpace = cardHeight > 0 ? Math.max(0, remainingPictureSpace - pictureHeight - pictureSpacing) : 0;
  // Aim the logo's middle at 20% of the screen; move it up only enough to clear the picture.
  const desiredLogoTopGap = Math.max(0, viewportHeight * 0.20 - logoSize / 2 - paddingTop);
  const logoTopGap = Math.min(spareLogoSpace, desiredLogoTopGap);
  const logoBottomGap = spareLogoSpace - logoTopGap + 16;
  const pictureAreaHeight = pictureHeight + PICTURE_CARD_GAP;
  // Allow a 1dp rounding difference. Scroll only when the card and minimum picture cannot fit.
  const needsScroll = cardHeight > 0 && remainingPictureSpace < MIN_PICTURE_HEIGHT + pictureSpacing - 1;

  // Returning to a text size that fits also returns the page to its normal top position.
  useEffect(() => {
    if (!needsScroll) landingScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [needsScroll]);

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

      {/* One screen normally; scrolling is a safety net when large text leaves too little room. */}
      <ScrollView
        ref={landingScrollRef}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        scrollEnabled={needsScroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[styles.logoDisc, { width: logoSize, height: logoSize, borderRadius: logoSize / 2, marginTop: logoTopGap, marginBottom: logoBottomGap }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel="SakayNa"
        >
          <BrandLogo variant="secondary" height={logoSize * 0.56} style={styles.logoMark} />
        </View>

        {/* One non-interactive picture: TalkBack reads its label once. */}
        <View style={[styles.artArea, { height: pictureAreaHeight }]} pointerEvents="none">
          <Image
            source={LANDING_MIDDLE_IMAGE}
            style={{ width: pictureWidth, height: pictureHeight }}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Illustration of a barangay van on a curved road, with barangay buildings and location pins."
            accessibilityIgnoresInvertColors
          />
        </View>

        {/* White card with a soft shadow (DESIGN.md Style) with the approved words and the buttons in thumb reach. */}
        <View style={styles.card} onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}>
          <Text style={styles.heading}>Request a Ride now</Text>

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
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_COLOR, opacity: backdropOpacity }]} pointerEvents="none" />
          <Pressable
            style={styles.sheetDismissArea}
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />

          <Animated.View
            style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: dragY }] }]}
          >
            {/* Drag area: the finger grabs the sheet here. It is kept out of the scroll list below so they don't fight. */}
            <View style={styles.sheetGrabArea} {...sheetDrag.panHandlers}>
              <View style={styles.sheetHandle} />

              <Text style={styles.sheetTitle} accessibilityRole="header">
                Log in or sign up
              </Text>
              <Text style={styles.sheetSubtitle}>Choose how you want to continue.</Text>
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
                  onPress={signInWithGoogle}
                />

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>

                <SheetOption icon="email-outline" label="Sign up with Email" onPress={openEmailSignup} />
              </View>

              <Pressable style={styles.emailLink} onPress={openEmailLogin} accessibilityRole="link">
                <Text style={styles.emailLinkText}>
                  Already have an account? <Text style={styles.linkStrong}>Log in with email</Text>
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
function SheetOption({ icon, image, label, onPress }) {
  return (
    <Pressable
      style={styles.option}
      onPress={onPress}
      android_ripple={{ color: RIPPLE_COLOR }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {image ? (
        <Image source={image} style={styles.optionImage} accessibilityIgnoresInvertColors />
      ) : (
        <MaterialCommunityIcons name={icon} size={26} color={NEUTRAL[900]} />
      )}
      <Text style={styles.optionText}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={NEUTRAL[700]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Landing gradient (DESIGN.md Style: only on landing and welcome screens): green 50 at the top to white.
  // Dark words and the dark clock icons stay readable. Phones without gradient support just show white.
  page: { flex: 1, backgroundColor: NEUTRAL[0], experimental_backgroundImage: `linear-gradient(180deg, ${GREEN[50]} 0%, ${NEUTRAL[0]} 65%)` },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 16 },
  // Round Hall Green disc with the white SakayNa mark.
  logoDisc: { alignItems: "center", justifyContent: "center", backgroundColor: GREEN[600], ...SHADOW.level2 },
  logoMark: { tintColor: "#FFFFFF" },
  // Trimmed visible picture, followed by its 2dp gap above the card.
  artArea: { flexShrink: 0, width: "100%", alignItems: "center", paddingBottom: PICTURE_CARD_GAP },
  // White card, 16 corners, a thin edge and a Level 1 shadow (DESIGN.md Style).
  card: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderRadius: CORNER.card,
    borderWidth: 1,
    borderColor: NEUTRAL[200],
    backgroundColor: NEUTRAL[0],
    ...SHADOW.level1,
  },
  // DESIGN.md "Title" size.
  heading: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  primaryButton: {
    minHeight: 56,
    marginTop: 20,
    borderRadius: CORNER.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: GREEN[600],
  },
  primaryButtonPressed: { backgroundColor: GREEN[800] },
  primaryButtonText: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: "#FFFFFF" },
  textLink: { minHeight: 48, marginTop: 8, alignItems: "center", justifyContent: "center" },
  textLinkText: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 24, color: NEUTRAL[700], textAlign: "center" },
  linkStrong: { fontFamily: FONT.bold, color: GREEN[700] },
  termsLink: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  // 15 = the smallest text size in DESIGN.md (was 12.5).
  termsText: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 20, color: NEUTRAL[700], textAlign: "center" },
  termsStrong: { fontFamily: FONT.semiBold, color: GREEN[700], textDecorationLine: "underline" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end" },
  sheetDismissArea: { flex: 1 },
  // DESIGN.md Style bottom sheet: white, 24 corners on top, a round grabber, Level 3 shadow.
  sheet: {
    width: "100%",
    borderTopLeftRadius: CORNER.sheet,
    borderTopRightRadius: CORNER.sheet,
    backgroundColor: NEUTRAL[0],
    overflow: "hidden",
    ...SHADOW.level3,
  },
  sheetGrabArea: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  sheetContent: { paddingHorizontal: 24 },
  // The grabber: round ends (DESIGN.md Style), dark enough to see.
  sheetHandle: { alignSelf: "center", width: 48, height: 5, marginBottom: 16, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[400] },
  sheetTitle: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  sheetSubtitle: { fontFamily: FONT.regular, marginTop: 6, fontSize: 17, lineHeight: 24, color: NEUTRAL[700], textAlign: "center" },
  sheetOptions: { gap: 10 },
  // White pill buttons with a clear grey edge (4.2:1).
  option: {
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: CORNER.pill,
    borderColor: NEUTRAL[500],
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  optionText: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  // Same space as the 26-wide icons, so all labels line up. The G itself is 24 x 24.
  optionImage: { width: 24, height: 24, marginHorizontal: 1 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: NEUTRAL[200] },
  orText: { fontSize: 15, fontFamily: FONT.medium, color: NEUTRAL[700] },
  emailLink: { minHeight: 48, marginTop: 4, alignItems: "center", justifyContent: "center" },
  emailLinkText: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 24, color: NEUTRAL[700], textAlign: "center" },
});
