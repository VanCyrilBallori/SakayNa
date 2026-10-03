import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "../components/BrandLogo";
import WebAuthPanel from "../components/WebAuthPanel";
import { DESIGN_COLORS } from "../constants/design";
import { auth } from "../firebase";
import { getAuthErrorMessage } from "../lib/session";

// Create Account (email sign-up, part 1 of 2).
// This page only makes the login (email + password) and sends the verification email.
// It does NOT save a profile. After the email is verified, the person chooses Resident or Driver
// and fills in that form, the same way Google users do.

// Firebase does not accept passwords shorter than this.
const MIN_PASSWORD_LENGTH = 6;

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Website on a computer: green panel on the left, form on the right. Phones keep the one-column layout.
  const wide = Platform.OS === "web" && width >= 960;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleNext = async () => {
    setErrorMessage("");
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Your passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { user } = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // If this fails, the Verify Email page has a "Resend email" button.
      await sendEmailVerification(user).catch((error) => console.log("Verification email failed:", error));
      router.replace("/verify-email");
    } catch (error) {
      console.log("Create account failed:", error);
      if (error?.code === "auth/email-already-in-use") {
        setErrorMessage("This email already has an account. Tap \"Log in\" below instead.");
      } else if (error?.code === "auth/weak-password") {
        setErrorMessage(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      } else {
        setErrorMessage(getAuthErrorMessage(error, "We could not create your account. Check your connection and try again."));
      }
    } finally {
      setIsSubmitting(false);
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
        {/* Wide screens: a "Back to home" link that goes to the home page. Phones: the back arrow, as before. */}
        {wide ? (
          <Pressable style={({ pressed }) => [styles.homeLink, pressed && styles.linkPressed]} onPress={() => router.replace("/")} accessibilityRole="link">
            <MaterialCommunityIcons name="arrow-left" size={22} color={DESIGN_COLORS.hallGreen} />
            <Text style={styles.homeLinkText}>Back to home</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.backArrow}
            onPress={goBack}
            android_ripple={{ color: "rgba(11, 122, 75, 0.12)", borderless: true }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={28} color={DESIGN_COLORS.ink} />
          </Pressable>
        )}

        {/* Wide screens skip the logo: the green panel already says "SakayNa". */}
        {wide ? null : <BrandLogo variant="main" height={40} style={styles.logo} accessibilityLabel="SakayNa" />}

        <Text style={styles.title} accessibilityRole="header">
          Create Account
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
            editable={!isSubmitting}
            accessibilityLabel="Email"
          />
        </Field>

        <Field icon="lock-outline" label="Password">
          <PasswordBox value={password} onChangeText={setPassword} placeholder="Create a password" label="Password" editable={!isSubmitting} />
          <Text style={styles.helperText}>At least {MIN_PASSWORD_LENGTH} characters.</Text>
        </Field>

        <Field icon="lock-check-outline" label="Confirm Password">
          <PasswordBox value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Type your password again" label="Confirm Password" editable={!isSubmitting} />
        </Field>

        {/* Pushes the button to the bottom when the page is short. Wide screens keep the form together instead. */}
        <View style={wide ? styles.wideSpacer : styles.spacer} />

        {errorMessage ? (
          <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={handleNext}
          disabled={isSubmitting}
          android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
          accessibilityRole="button"
          accessibilityState={{ busy: isSubmitting }}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "Creating account..." : "Next"}</Text>
        </Pressable>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace("/login")} disabled={isSubmitting} accessibilityRole="link" hitSlop={12} style={styles.loginLink}>
            <Text style={[styles.loginText, styles.loginLinkText]}>Log in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A label with a green icon, then the input below it. Same look as the Resident form.
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

// Password input with an eye button that shows or hides what was typed.
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
  helperText: { marginTop: 8, fontSize: 16, lineHeight: 23, color: DESIGN_COLORS.inkMuted },
  spacer: { flexGrow: 1, minHeight: 28 },
  errorText: { marginBottom: 12, fontSize: 16, lineHeight: 23, fontWeight: "600", color: DESIGN_COLORS.emergencyRed },
  button: { minHeight: 56, paddingHorizontal: 12, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  pressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  buttonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  loginRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 6 },
  loginText: { fontSize: 16, lineHeight: 23, color: DESIGN_COLORS.ink },
  loginLink: { minHeight: 48, justifyContent: "center" },
  loginLinkText: { fontWeight: "800", color: DESIGN_COLORS.hallGreen, textDecorationLine: "underline" },
  // Wide screens (website on a computer): two halves side by side, form in the middle of the right half.
  widePage: { flexDirection: "row" },
  wideRight: { flex: 1 },
  wideContent: { maxWidth: 440, justifyContent: "center", paddingTop: 32, paddingBottom: 32 },
  homeLink: { alignSelf: "flex-start", minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, paddingRight: 8, borderRadius: 16 },
  linkPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  homeLinkText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  wideSpacer: { height: 28 },
});
