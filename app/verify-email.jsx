import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { reload, sendEmailVerification } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "../components/BrandLogo";
import { CORNER, FONT, GREEN, NEUTRAL, RED } from "../constants/design";
import { auth } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";

// Verify Your Email (email sign-up, part 2 of 2).
// The person opens the link in their email, comes back, and taps "I verified my email".
// Then they choose Resident or Driver (Choose Role) and fill in that form.
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser, authStatus, profile, profileStatus } = useCurrentUserProfile();
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // True while "Start over" is logging out, so the check below does not also send them away.
  const leavingRef = useRef(false);

  // Nobody is signed in: nothing to verify, so go to the start page.
  useEffect(() => {
    if (authStatus === "ready" && !authUser && !leavingRef.current) {
      router.replace("/");
    }
  }, [authStatus, authUser, router]);

  // Counts the "Resend in 45s" timer down by one every second.
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Old accounts (for example from the old Apply to Drive page) already have a profile.
  const hasProfile = profileStatus === "ready" && Boolean(profile);
  const homeRoute = hasProfile ? getPostAuthenticationRoute(profile) : null;

  const handleVerified = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsChecking(true);
    setErrorMessage("");
    setMessage("");
    try {
      // Ask Firebase again whether the link was opened (the phone does not find out by itself).
      await reload(currentUser);
      if (!auth.currentUser?.emailVerified) {
        setErrorMessage("Your email is not verified yet. Open the link in the email we sent, then tap the button again.");
        return;
      }

      // The app shows Firestore a login "ID card" (token) that still says "not verified".
      // Getting a fresh one lets Firestore see the verified email right away.
      await auth.currentUser.getIdToken(true);
      router.replace(homeRoute ?? "/choose-role");
    } catch (error) {
      console.log("Email verification check failed:", error);
      setErrorMessage(getAuthErrorMessage(error, "We could not check your email. Check your connection and try again."));
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || cooldown > 0) return;

    setIsSending(true);
    setErrorMessage("");
    setMessage("");
    try {
      await sendEmailVerification(currentUser);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage("We sent a new email. Open the newest one.");
    } catch (error) {
      console.log("Resend verification failed:", error);
      setErrorMessage(getAuthErrorMessage(error, "We could not send the email. Please try again later."));
    } finally {
      setIsSending(false);
    }
  };

  // Typed the wrong email? Log out and go back to Create Account.
  const startOver = async () => {
    leavingRef.current = true;
    try {
      await logoutCurrentUser();
    } catch (error) {
      console.log("Start over logout failed:", error);
    }
    router.replace("/signup");
  };

  const isBusy = isChecking || isSending;

  return (
    <View style={styles.page}>
      {/* Dark clock/battery icons so they stay visible on the white page. */}
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo variant="main" height={40} style={styles.logo} accessibilityLabel="SakayNa" />

        <View style={styles.middle}>
          <View style={styles.disc}>
            <MaterialCommunityIcons name="email-outline" size={52} color={GREEN[600]} />
          </View>

          <Text style={styles.title} accessibilityRole="header">
            Verify Your Email
          </Text>

          <Text style={styles.bodyText}>
            We sent a link to{"\n"}
            <Text style={styles.email}>{authUser?.email || "your email"}</Text>.{"\n"}
            Open it, then come back here.
          </Text>

          <Text style={styles.helperText}>Can&apos;t find it? Check your Spam folder.</Text>
        </View>

        {errorMessage ? (
          <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        ) : null}
        {message ? (
          <Text style={styles.successText} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.filledButton, pressed && styles.filledPressed]}
            onPress={handleVerified}
            disabled={isBusy}
            android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
            accessibilityRole="button"
            accessibilityState={{ busy: isChecking }}
          >
            <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{isChecking ? "Checking..." : "I verified my email"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.button, styles.outlinedButton, cooldown > 0 && styles.waitingButton, pressed && styles.outlinedPressed]}
            onPress={handleResend}
            disabled={isBusy || cooldown > 0}
            android_ripple={{ color: "rgba(11, 122, 75, 0.12)" }}
            accessibilityRole="button"
            accessibilityState={{ disabled: cooldown > 0, busy: isSending }}
          >
            <Text style={[styles.buttonText, { color: cooldown > 0 ? NEUTRAL[700] : GREEN[600] }]}>
              {isSending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </Text>
          </Pressable>

          {homeRoute ? (
            <Pressable onPress={() => router.replace(homeRoute)} disabled={isBusy} accessibilityRole="link" style={styles.textLink}>
              <Text style={styles.textLinkText}>Continue to SakayNa</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={startOver} disabled={isBusy} accessibilityRole="link" style={styles.textLink}>
            <Text style={[styles.helperText, styles.noMargin, styles.inkText]}>
              Wrong email? <Text style={styles.textLinkText}>Start over</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NEUTRAL[50] },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20 },
  logo: { alignSelf: "center" },
  // Takes the free space between the logo and the buttons and centers the message in it.
  middle: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  disc: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[50] },
  title: { marginTop: 24, fontSize: 28, lineHeight: 34, fontFamily: FONT.bold, textAlign: "center", color: NEUTRAL[900] },
  bodyText: { fontFamily: FONT.regular, marginTop: 12, maxWidth: 420, fontSize: 17, lineHeight: 24, textAlign: "center", color: NEUTRAL[900] },
  email: { fontFamily: FONT.bold },
  helperText: { fontFamily: FONT.regular, marginTop: 16, maxWidth: 420, fontSize: 15, lineHeight: 20, textAlign: "center", color: NEUTRAL[700] },
  noMargin: { marginTop: 0 },
  inkText: { color: NEUTRAL[900] },
  errorText: { marginBottom: 12, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, textAlign: "center", color: RED[600] },
  successText: { marginBottom: 12, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, textAlign: "center", color: GREEN[600] },
  buttons: { gap: 12 },
  button: { minHeight: 56, paddingHorizontal: 12, borderRadius: CORNER.pill, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  filledButton: { backgroundColor: GREEN[600] },
  outlinedButton: { borderWidth: 1.5, borderColor: NEUTRAL[500], backgroundColor: NEUTRAL[0] },
  waitingButton: { borderColor: NEUTRAL[500] },
  // Pressed: darker green (filled) or Board Tint behind the words (outlined), like Log In.
  filledPressed: { backgroundColor: GREEN[800] },
  outlinedPressed: { backgroundColor: NEUTRAL[100] },
  buttonText: { fontSize: 17, fontFamily: FONT.semiBold, textAlign: "center" },
  textLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  textLinkText: { fontSize: 17, lineHeight: 24, fontFamily: FONT.bold, color: GREEN[600], textDecorationLine: "underline" },
});
