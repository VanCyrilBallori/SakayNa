import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { getPostAuthenticationRoute, isDisabledProfile, isSupportedRole } from "../lib/roles";
import { clearLocalSession, getAuthErrorMessage, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";

const protectedRoutes = new Set(["admin-home", "dispatcher-home", "driver-home", "driver-status", "resident-home"]);

export default function AuthRouteGate({ children }) {
  const router = useRouter();
  const segments = useSegments();
  const routeName = segments[0];
  const requiresProtection = protectedRoutes.has(routeName);
  const { authUser, authStatus, profile, profileStatus, profileError, retryProfile } = useCurrentUserProfile();
  const destination = profileStatus === "ready" ? getPostAuthenticationRoute(profile) : null;
  const currentRoute = routeName ? `/${routeName}` : "/";

  useEffect(() => {
    if (!requiresProtection || authStatus !== "ready") {
      return;
    }

    if (!authUser) {
      router.replace("/login");
      return;
    }

    if (profileStatus === "ready" && (!isSupportedRole(profile?.role) || isDisabledProfile(profile))) {
      clearLocalSession({ uid: authUser?.uid, email: authUser?.email ?? "" });
      return;
    }

    if (profileStatus === "ready" && destination && destination !== currentRoute) {
      router.replace(destination);
    }
  }, [authStatus, authUser, currentRoute, destination, profileStatus, requiresProtection, router]);

  if (!requiresProtection) {
    return children;
  }

  if (authStatus !== "ready" || profileStatus === "idle" || profileStatus === "loading") {
    return <GateState loading message="Checking your account access..." />;
  }

  if (!authUser) {
    return <GateState loading message="Redirecting to login..." />;
  }

  if (profileStatus === "missing" || profileStatus === "error") {
    return <GateState message={profileError} onRetry={retryProfile} onLogout={() => handleLogout(router)} />;
  }

  if (!isSupportedRole(profile?.role)) {
    return <GateState message="Your account role is missing or invalid. Please contact SakayNa support." onLogout={() => handleLogout(router)} />;
  }

  if (isDisabledProfile(profile)) {
    return <GateState message="This account is currently disabled. Please contact SakayNa support." onLogout={() => handleLogout(router)} />;
  }

  if (!destination || destination !== currentRoute) {
    return <GateState loading message="Redirecting to your dashboard..." />;
  }

  return children;
}

async function handleLogout(router) {
  try {
    await logoutCurrentUser();
    router.replace("/login");
  } catch (error) {
    console.log("Gate logout failed:", getAuthErrorMessage(error, "Logout could not be completed. Please try again."));
  }
}

function GateState({ loading = false, message, onRetry, onLogout }) {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {loading ? <ActivityIndicator size="large" color="#06774B" /> : null}
        <Text style={styles.message}>{message}</Text>
        {onRetry ? <TouchableOpacity style={styles.primaryButton} onPress={onRetry}><Text style={styles.primaryText}>Retry</Text></TouchableOpacity> : null}
        {onLogout ? <TouchableOpacity style={styles.secondaryButton} onPress={onLogout}><Text style={styles.secondaryText}>Log Out</Text></TouchableOpacity> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#F5F7F6" },
  card: { width: "100%", maxWidth: 440, alignItems: "center", padding: 24, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE8E2" },
  message: { marginTop: 14, color: "#35564A", fontSize: 16, lineHeight: 24, textAlign: "center" },
  primaryButton: { width: "100%", minHeight: 48, marginTop: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#06774B" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryButton: { marginTop: 14, padding: 10 },
  secondaryText: { color: "#06774B", fontSize: 15, fontWeight: "700" },
});