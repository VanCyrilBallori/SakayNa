import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "../components/BrandLogo";
import WebAuthPanel from "../components/WebAuthPanel";
import { FIRESTORE_COLLECTIONS } from "../constants/app";
import { DESIGN_COLORS } from "../constants/design";
import { auth, db } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../lib/session";

// Log In. Same layout as Create Account (signup.jsx), in the DESIGN.md colors and corners.

const resetSuccessMessage = "If an account matches that email address, password reset instructions will be sent shortly.";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Website on a computer: green panel on the left, form on the right. Phones keep the one-column layout.
  const wide = Platform.OS === "web" && width >= 960;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();
  const isBusy = isSubmitting || isResettingPassword;

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!normalizedEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const userDoc = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, userCredential.user.uid));
      const profile = userDoc.exists() ? userDoc.data() : null;

      // No profile yet = they stopped halfway through sign-up. Continue where they left off.
      if (!profile) {
        router.replace(userCredential.user.emailVerified ? "/choose-role" : "/verify-email");
        return;
      }

      const destination = getPostAuthenticationRoute(profile);
      if (!destination) {
        await logoutCurrentUser();
        setErrorMessage("Your account is unavailable or has an invalid role. Please contact SakayNa support.");
        return;
      }
      router.replace(destination);
    } catch (error) {
      console.log("Login failed:", error);
      setErrorMessage(getAuthErrorMessage(error, "We could not verify your account profile. Check your connection and try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!normalizedEmail) {
      setErrorMessage("Enter your email address first, then select Forgot Password.");
      return;
    }
    try {
      setIsResettingPassword(true);
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSuccessMessage(resetSuccessMessage);
    } catch (error) {
      console.log("Password reset failed:", error);
      if (error?.code === "auth/user-not-found") setSuccessMessage(resetSuccessMessage);
      else setErrorMessage(getAuthErrorMessage(error, "We could not send password reset instructions. Please try again later."));
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    // "padding" on Android too: the app is edge-to-edge, so Android no longer shrinks the screen for the keyboard.
    // This adds the space instead, and the page scrolls so the box being typed in stays visible.
    <KeyboardAvoidingView behavior="padding" style={[styles.page, wide && styles.widePage]}>
      {/* Dark clock/battery icons so they stay visible on the white page. */}
      <StatusBar style="dark" />
      {wide ? <WebAuthPanel /> : null}
      <ScrollView
        style={wide ? styles.wideRight : undefined}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }, wide && styles.wideContent]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back to the landing page, as before. Wide screens use the house button in the top-right corner instead (below). */}
        {wide ? null : (
          <Pressable
            style={styles.backArrow}
            onPress={() => router.replace("/")}
            android_ripple={{ color: "rgba(11, 122, 75, 0.12)", borderless: true }}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={28} color={DESIGN_COLORS.ink} />
          </Pressable>
        )}

        {/* Wide screens skip the logo: the green panel already says "SakayNa". */}
        {wide ? null : <BrandLogo variant="main" height={40} style={styles.logo} accessibilityLabel="SakayNa" />}

        <Text style={styles.title} accessibilityRole="header">
          Log In
        </Text>

        <Field icon="email-outline" label="Email">
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="juan@example.com"
            placeholderTextColor={DESIGN_COLORS.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!isBusy}
            accessibilityLabel="Email"
          />
        </Field>

        <Field icon="lock-outline" label="Password">
          <PasswordBox value={password} onChangeText={setPassword} placeholder="Your password" label="Password" editable={!isBusy} />
          {/* Right under the password, where people look for it. It needs the email typed above first. */}
          <Pressable
            style={({ pressed }) => [styles.forgotLink, pressed && styles.linkPressed]}
            onPress={handlePasswordReset}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text style={[styles.forgotText, isBusy && styles.disabledText]}>
              {isResettingPassword ? "Sending reset instructions..." : "Forgot password?"}
            </Text>
          </Pressable>
        </Field>

        {/* Pushes the button to the bottom when the page is short. Wide screens keep the form together instead. */}
        <View style={wide ? styles.wideSpacer : styles.spacer} />

        {errorMessage ? (
          <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        ) : null}
        {successMessage ? (
          <Text style={styles.successText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {successMessage}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleLogin}
          disabled={isBusy}
          android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
          accessibilityRole="button"
          accessibilityState={{ busy: isSubmitting }}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "Logging in..." : "Log In"}</Text>
        </Pressable>

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>No account yet?</Text>
          <Pressable onPress={() => router.push("/signup")} disabled={isBusy} accessibilityRole="link" hitSlop={12} style={styles.signupLink}>
            <Text style={[styles.signupText, styles.signupLinkText]}>Create account</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Wide screens: house button in the top-right corner that goes to the home page. */}
      {wide ? (
        <Pressable
          style={({ pressed }) => [styles.homeButton, pressed && styles.linkPressed]}
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <MaterialCommunityIcons name="home-outline" size={26} color={DESIGN_COLORS.ink} />
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// A label with a green icon, then the input below it. Same look as Create Account.
function Field({ icon, label, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <MaterialCommunityIcons name={icon} size={22} color={DESIGN_COLORS.hallGreen} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

// Password input with an eye button that shows or hides what was typed. Same as Create Account.
function PasswordBox({ value, onChangeText, placeholder, label, editable }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.passwordBox}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={DESIGN_COLORS.placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        editable={editable}
        accessibilityLabel={label}
      />
      <Pressable
        style={styles.eyeButton}
        onPress={() => setVisible(!visible)}
        android_ripple={{ color: "rgba(11, 122, 75, 0.12)", borderless: true }}
        accessibilityRole="button"
        accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
      >
        <MaterialCommunityIcons name={visible ? "eye-off-outline" : "eye-outline"} size={24} color={DESIGN_COLORS.inkMuted} />
      </Pressable>
    </View>
  );
}

// Sizes match Create Account. Colors and corners follow DESIGN.md: Hall Green, Ink text, 16 corners.
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: DESIGN_COLORS.paperWhite },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20 },
  backArrow: { width: 48, height: 48, marginLeft: -8, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  logo: { alignSelf: "center", marginTop: 4, marginBottom: 28 },
  title: { marginBottom: 8, fontSize: 28, lineHeight: 36, fontWeight: "800", color: DESIGN_COLORS.ink },
  field: { marginTop: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  label: { flexShrink: 1, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  input: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    borderRadius: 16,
    fontSize: 17,
    color: DESIGN_COLORS.ink,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  passwordBox: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  passwordInput: { flex: 1, minHeight: 56, paddingLeft: 14, paddingRight: 4, fontSize: 17, color: DESIGN_COLORS.ink },
  eyeButton: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26 },
  // Text button, 48 tall so it is easy to tap. Pressed = Board Tint behind it.
  forgotLink: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center", marginTop: 4, paddingRight: 8, borderRadius: 16 },
  linkPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  forgotText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  disabledText: { color: DESIGN_COLORS.inkMuted },
  spacer: { flexGrow: 1, minHeight: 28 },
  errorText: { marginBottom: 12, fontSize: 16, lineHeight: 23, fontWeight: "600", color: DESIGN_COLORS.emergencyRed },
  successText: { marginBottom: 12, fontSize: 16, lineHeight: 23, fontWeight: "600", color: DESIGN_COLORS.hallGreen },
  button: { minHeight: 56, paddingHorizontal: 12, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  buttonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  buttonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  signupRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 6 },
  signupText: { fontSize: 16, lineHeight: 23, color: DESIGN_COLORS.ink },
  signupLink: { minHeight: 48, justifyContent: "center" },
  signupLinkText: { fontWeight: "800", color: DESIGN_COLORS.hallGreen, textDecorationLine: "underline" },
  // Wide screens (website on a computer): two halves side by side, form in the middle of the right half.
  widePage: { flexDirection: "row" },
  wideRight: { flex: 1 },
  // Extra room at the top so the form never slides under the house button.
  wideContent: { maxWidth: 440, justifyContent: "center", paddingTop: 80, paddingBottom: 32 },
  homeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  wideSpacer: { height: 28 },
});
