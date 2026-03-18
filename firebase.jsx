import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD5hG_pYOQ3l493HtB0FTAcP-ipJig6O04",
  authDomain: "sakayna-571e8.firebaseapp.com",
  projectId: "sakayna-571e8",
  storageBucket: "sakayna-571e8.firebasestorage.app",
  messagingSenderId: "374713501645",
  appId: "1:374713501645:web:752bbcefd21409739ba684",
  measurementId: "G-144B4L3TD8",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let dbInstance;

try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
  });
} catch {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

export const initializeAnalytics = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isSupported();
  return supported ? getAnalytics(app) : null;
};
