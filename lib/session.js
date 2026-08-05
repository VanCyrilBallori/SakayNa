import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { FIRESTORE_COLLECTIONS } from "../constants/app";
import { auth, db } from "../firebase";

const memoryStorage = new Map();

const getStorage = () => {
  const storage = globalThis?.localStorage;

  if (storage && typeof storage.getItem === "function" && typeof storage.removeItem === "function") {
    return storage;
  }

  return {
    getItem: (key) => memoryStorage.get(key) ?? null,
    removeItem: (key) => memoryStorage.delete(key),
  };
};

// Cached profile values are intentionally not used for authentication or routing.
export const saveLocalUserProfile = () => {};

export const clearLocalSession = ({ uid, email } = {}) => {
  const storage = getStorage();

  if (uid) {
    storage.removeItem(`sakayna-role:${uid}`);
    storage.removeItem(`sakayna-user:${uid}`);
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    storage.removeItem(`sakayna-user-email:${normalizedEmail}`);
  }

  storage.removeItem("sakayna-last-user");
};

export const getAuthErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact SakayNa support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment before trying again.";
    case "auth/network-request-failed":
    case "unavailable":
      return "We could not reach the service. Check your connection and try again.";
    case "permission-denied":
    case "auth/operation-not-allowed":
      return "Your account could not be verified. Please contact SakayNa support.";
    default:
      return fallback;
  }
};

export const logoutCurrentUser = async () => {
  const currentUser = auth.currentUser;

  try {
    await signOut(auth);
  } finally {
    clearLocalSession({ uid: currentUser?.uid, email: currentUser?.email ?? "" });
  }
};

export const getDisplayName = (authUser, profile) => {
  if (profile?.fullName?.trim()) {
    return profile.fullName.trim();
  }

  if (authUser?.displayName?.trim()) {
    return authUser.displayName.trim();
  }

  if (authUser?.email) {
    return authUser.email.split("@")[0];
  }

  return "User";
};

export const useCurrentUserProfile = () => {
  const [authUser, setAuthUser] = useState(auth.currentUser);
  const [authStatus, setAuthStatus] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("idle");
  const [profileError, setProfileError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let unsubscribeProfile = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      unsubscribeProfile();
      setAuthUser(nextUser);
      setAuthStatus("ready");

      if (!nextUser) {
        setProfile(null);
        setProfileStatus("signed-out");
        setProfileError("");
        return;
      }

      setProfile(null);
      setProfileStatus("loading");
      setProfileError("");
      unsubscribeProfile = onSnapshot(
        doc(db, FIRESTORE_COLLECTIONS.USERS, nextUser.uid),
        (snapshot) => {
          if (!snapshot.exists()) {
            clearLocalSession({ uid: nextUser.uid, email: nextUser.email ?? "" });
            setProfile(null);
            setProfileStatus("missing");
            setProfileError("Your SakayNa account profile could not be found. Please contact support.");
            return;
          }

          setProfile(snapshot.data());
          setProfileStatus("ready");
          setProfileError("");
        },
        (error) => {
          console.log("Profile listener failed:", error);
          clearLocalSession({ uid: nextUser.uid, email: nextUser.email ?? "" });
          setProfile(null);
          setProfileStatus("error");
          setProfileError(getAuthErrorMessage(error, "We could not verify your account profile. Check your connection and try again."));
        }
      );
    });

    return () => {
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, [retryToken]);

  return {
    authUser,
    authStatus,
    profile,
    profileStatus,
    profileError,
    retryProfile: () => setRetryToken((value) => value + 1),
    displayName: getDisplayName(authUser, profile),
  };
};