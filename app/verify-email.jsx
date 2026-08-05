import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { reload, sendEmailVerification } from "firebase/auth";
import { StyleSheet, Text } from "react-native";

import AuthLayout from "../components/auth/AuthLayout";
import AppButton from "../components/ui/AppButton";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import { auth } from "../firebase";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, useCurrentUserProfile } from "../lib/session";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const router = useRouter();
  const { authUser, profile, profileStatus } = useCurrentUserProfile();
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const refreshVerificationStatus = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsRefreshing(true);
    setErrorMessage("");
    try {
      await reload(currentUser);
      setEmailVerified(Boolean(auth.currentUser?.emailVerified));
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error, "We could not refresh your email verification status. Try again."));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authUser) {
      router.replace("/login");
      return;
    }
    refreshVerificationStatus();
  }, [authUser, refreshVerificationStatus, router]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || cooldown > 0) return;
    setIsSending(true);
    setErrorMessage("");
    setMessage("");
    try {
      await sendEmailVerification(currentUser);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage("A new verification email has been sent.");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error, "We could not send a verification email. Please try again later."));
    } finally {
      setIsSending(false);
    }
  };

  const handleContinue = () => {
    const route = getPostAuthenticationRoute(profile);
    if (profileStatus !== "ready" || !route) {
      setErrorMessage("Your account is not ready yet. Please try again in a moment.");
      return;
    }
    router.replace(route);
  };

  return (
    <AuthLayout title="Verify Your Email">
      <Text style={styles.message}>We sent a verification link to {authUser?.email || "your email address"}.</Text>
      <Text style={styles.notice}>Email verification is available now but is not enforced for existing accounts during this migration.</Text>
      <FeedbackMessage message={isRefreshing ? "Checking verification status..." : emailVerified ? "Email verified." : "Email not verified yet."} tone={emailVerified ? "success" : "info"} />
      <FeedbackMessage message={message} tone="success" />
      <FeedbackMessage message={errorMessage} tone="error" />
      <AppButton label="I Verified My Email" onPress={refreshVerificationStatus} loading={isRefreshing} style={styles.primaryButton} />
      <AppButton label={cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend Verification Email"} variant="secondary" onPress={handleResend} loading={isSending} disabled={cooldown > 0} style={styles.secondaryButton} />
      <AppButton label="Continue to SakayNa" variant="secondary" onPress={handleContinue} disabled={profileStatus !== "ready"} style={styles.continueButton} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 16, lineHeight: 24, color: "#557166", textAlign: "center" },
  notice: { marginTop: 12, fontSize: 14, lineHeight: 21, color: "#557166", textAlign: "center" },
  primaryButton: { width: "100%", marginTop: 20 },
  secondaryButton: { width: "100%", marginTop: 12 },
  continueButton: { width: "100%", marginTop: 12 },
});