import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";

export const saveLocalUserProfile = ({ uid, email, fullName, barangay, phoneNumber, role }) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    uid,
    email: normalizedEmail,
    fullName,
    barangay,
    phoneNumber,
    role,
  };

  window.localStorage.setItem(`sakayna-role:${uid}`, role);
  window.localStorage.setItem(`sakayna-user:${uid}`, JSON.stringify(payload));
  window.localStorage.setItem(`sakayna-user-email:${normalizedEmail}`, JSON.stringify(payload));
  window.localStorage.setItem("sakayna-last-user", JSON.stringify(payload));
};

export const getLocalUserProfile = ({ uid, email }) => {
  if (typeof window === "undefined") {
    return null;
  }

  if (uid) {
    const byUid = window.localStorage.getItem(`sakayna-user:${uid}`);
    if (byUid) {
      return JSON.parse(byUid);
    }
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const byEmail = window.localStorage.getItem(`sakayna-user-email:${normalizedEmail}`);
    if (byEmail) {
      return JSON.parse(byEmail);
    }
  }

  const lastUser = window.localStorage.getItem("sakayna-last-user");
  return lastUser ? JSON.parse(lastUser) : null;
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
  const [profile, setProfile] = useState(() =>
    getLocalUserProfile({
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email ?? "",
    })
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser);
      setProfile(
        getLocalUserProfile({
          uid: nextUser?.uid,
          email: nextUser?.email ?? "",
        })
      );
    });

    return unsubscribe;
  }, []);

  return {
    authUser,
    profile,
    displayName: getDisplayName(authUser, profile),
  };
};
