import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { reload, sendEmailVerification } from "firebase/auth";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import BrandLogo from "../components/BrandLogo";
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
    if (!currentUser) {
      return;
    }

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
    if (!cooldown) {
      return undefined;
    }

    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);


  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || cooldown > 0) {
      return;
    }

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
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <BrandLogo variant="main" height={40} style={styles.logo} />
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.message}>We sent a verification link to {authUser?.email || "your email address"}.</Text>
        <Text style={styles.notice}>Email verification is available now but is not enforced for existing accounts during this migration.</Text>

        {isRefreshing ? <ActivityIndicator color="#06774B" /> : <Text style={styles.status}>{emailVerified ? "Email verified" : "Email not verified yet"}</Text>}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={refreshVerificationStatus} disabled={isRefreshing}>
          <Text style={styles.primaryText}>{isRefreshing ? "Checking..." : "I Verified My Email"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, (isSending || cooldown > 0) && styles.disabledButton]} onPress={handleResend} disabled={isSending || cooldown > 0}>
          <Text style={styles.secondaryText}>{isSending ? "Sending..." : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend Verification Email"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={profileStatus !== "ready"}>
          <Text style={styles.continueText}>Continue to SakayNa</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 500, padding: 24, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE8E2", alignItems: "center" },
  logo: { marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "800", color: "#17382E", textAlign: "center" },
  message: { marginTop: 12, fontSize: 16, lineHeight: 24, color: "#557166", textAlign: "center" },
  notice: { marginTop: 12, fontSize: 14, lineHeight: 21, color: "#557166", textAlign: "center" },
  status: { marginTop: 22, color: "#17382E", fontSize: 16, fontWeight: "700" },
  success: { marginTop: 14, color: "#06774B", textAlign: "center" },
  error: { marginTop: 14, color: "#B42318", textAlign: "center" },
  primaryButton: { width: "100%", minHeight: 50, marginTop: 24, borderRadius: 12, backgroundColor: "#06774B", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryButton: { width: "100%", minHeight: 48, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: "#06774B", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#06774B", fontSize: 15, fontWeight: "700" },
  continueButton: { marginTop: 16, padding: 10 },
  continueText: { color: "#557166", fontSize: 15, fontWeight: "700" },
  disabledButton: { opacity: 0.55 },
});