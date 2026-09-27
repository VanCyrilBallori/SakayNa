import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter, useSegments } from "expo-router";

import ScreenState from "./ui/ScreenState";
import { ROLES } from "../constants/app";
import { askResidentPermissionsOnce } from "../lib/permissions";
import { getPostAuthenticationRoute, isDisabledProfile, isSupportedRole } from "../lib/roles";
import { clearLocalSession, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";

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
      clearLocalSession({ uid: authUser.uid, email: authUser.email ?? "" });
      return;
    }

    if (profileStatus === "ready" && destination && destination !== currentRoute) {
      router.replace(destination);
    }
  }, [authStatus, authUser, currentRoute, destination, profile, profileStatus, requiresProtection, router]);

  // Phone app only: once a Resident is let through to their home screen, ask for the permissions
  // their features use (notifications, location, phone calls). Other roles are not asked for now.
  const residentAllowedIn =
    requiresProtection && Boolean(authUser) && profileStatus === "ready" && profile?.role === ROLES.RESIDENT && destination === currentRoute;

  useEffect(() => {
    if (Platform.OS !== "web" && residentAllowedIn) {
      askResidentPermissionsOnce();
    }
  }, [residentAllowedIn]);

  if (!requiresProtection) {
    return children;
  }

  if (authStatus !== "ready" || profileStatus === "idle" || profileStatus === "loading") {
    return <ScreenState loading title="Checking access" message="Checking your account access..." />;
  }

  if (!authUser) {
    return <ScreenState loading message="Redirecting to login..." />;
  }

  if (profileStatus === "missing" || profileStatus === "error") {
    return <ScreenState title="Account unavailable" message={profileError} actionLabel="Retry" onAction={retryProfile} secondaryActionLabel="Log Out" onSecondaryAction={() => handleLogout(router)} />;
  }

  if (!isSupportedRole(profile?.role)) {
    return <ScreenState title="Invalid role" message="Your account role is missing or invalid. Please contact SakayNa support." actionLabel="Log Out" onAction={() => handleLogout(router)} />;
  }

  if (isDisabledProfile(profile)) {
    return <ScreenState title="Account disabled" message="This account is currently disabled. Please contact SakayNa support." actionLabel="Log Out" onAction={() => handleLogout(router)} />;
  }

  if (!destination || destination !== currentRoute) {
    return <ScreenState loading message="Redirecting to your dashboard..." />;
  }

  return children;
}

async function handleLogout(router) {
  try {
    await logoutCurrentUser();
    router.replace("/login");
  } catch (error) {
    console.log("Gate logout failed:", error);
  }
}