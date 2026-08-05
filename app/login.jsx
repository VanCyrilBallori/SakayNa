import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import AuthLayout, { AuthLink } from "../components/auth/AuthLayout";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import AppButton from "../components/ui/AppButton";
import PasswordInput from "../components/ui/PasswordInput";
import { FIRESTORE_COLLECTIONS } from "../constants/app";
import { COLORS, RADIUS } from "../constants/design";
import { auth, db } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser } from "../lib/session";

const resetSuccessMessage = "If an account matches that email address, password reset instructions will be sent shortly.";

export default function Login() {
  const router = useRouter();
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
      const destination = getPostAuthenticationRoute(profile);
      if (!destination) {
        await logoutCurrentUser();
        setErrorMessage(profile ? "Your account is unavailable or has an invalid role. Please contact SakayNa support." : "Your SakayNa account profile could not be found. Please contact support.");
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
    <AuthLayout title="Log In" onBack={() => router.replace("/")} footer={<AuthLink disabled={isBusy} onPress={() => router.push("/signup")}>No account yet? Create Account</AuthLink>}>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8B8B8B" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} editable={!isBusy} />
      <PasswordInput value={password} onChangeText={setPassword} editable={!isBusy} style={styles.passwordInput} />
      <FeedbackMessage message={errorMessage} tone="error" />
      <FeedbackMessage message={successMessage} tone="success" />
      <AppButton label="Log In" onPress={handleLogin} loading={isSubmitting} disabled={isResettingPassword} style={styles.primaryButton} />
      <View style={styles.linkWrap}><AuthLink disabled={isBusy} onPress={handlePasswordReset}>{isResettingPassword ? "Sending reset instructions..." : "Forgot Password?"}</AuthLink></View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  input: { width: "100%", minHeight: 50, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: "#D7D7D7", borderRadius: RADIUS.md, fontSize: 15, color: "#111111", backgroundColor: "#FCFCFC" },
  passwordInput: { marginBottom: 12 },
  primaryButton: { width: "100%", marginTop: 16, backgroundColor: COLORS.primary },
  linkWrap: { marginTop: 16, alignItems: "center" },
});