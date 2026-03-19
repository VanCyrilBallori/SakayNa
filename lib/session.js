import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";

const memoryStorage = new Map();

const getStorage = () => {
  const storage = globalThis?.localStorage;

  if (
    storage &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function"
  ) {
    return storage;
  }

  return {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      memoryStorage.set(key, value);
    },
  };
};

export const saveLocalUserProfile = ({ uid, email, fullName, barangay, phoneNumber, role }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    uid,
    email: normalizedEmail,
    fullName,
    barangay,
    phoneNumber,
    role,
  };
  const storage = getStorage();

  storage.setItem(`sakayna-role:${uid}`, role);
  storage.setItem(`sakayna-user:${uid}`, JSON.stringify(payload));
  storage.setItem(`sakayna-user-email:${normalizedEmail}`, JSON.stringify(payload));
  storage.setItem("sakayna-last-user", JSON.stringify(payload));
};

export const getLocalUserProfile = ({ uid, email }) => {
  const storage = getStorage();

  if (uid) {
    const byUid = storage.getItem(`sakayna-user:${uid}`);
    if (byUid) {
      return JSON.parse(byUid);
    }
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const byEmail = storage.getItem(`sakayna-user-email:${normalizedEmail}`);
    if (byEmail) {
      return JSON.parse(byEmail);
    }
  }

  const lastUser = storage.getItem("sakayna-last-user");
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
