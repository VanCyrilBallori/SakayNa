import { deleteUser, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";

import { auth, db } from "../firebase";

// Delete Account (ROADMAP Task 3.15). A Resident or Driver deletes their own account:
// 1. They sign in again (password, or Google on the phone): Firebase only lets a login be deleted right after a sign-in.
// 2. Their profile gets a "deleted" mark (deletedAt) and loses the phone number, address and picture.
//    Name and barangay stay, so old rides and duty records still show who it was (Privacy Policy section 7).
// 3. The login itself is deleted. Rides, alerts and duty records are not touched.
// No firestore.rules change: people may already save these fields on their own profile.

// How this account signs in: "password", "google", or "" if unknown.
export const getSignInMethod = (user = auth.currentUser) => {
  const providers = (user?.providerData || []).map((provider) => provider.providerId);
  if (providers.includes("password")) return "password";
  if (providers.includes("google.com")) return "google";
  return "";
};

// Step 1: prove it is really them. Throws an error with a code if it fails (see getDeleteErrorMessage).
export const confirmIdentity = async ({ method, password }) => {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("Not signed in"), { code: "not-signed-in" });

  if (method === "password") {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return;
  }

  // Google: the same account picker as on the start screen (phone app only; the website has no Google sign-in).
  if (Platform.OS === "web") throw Object.assign(new Error("Google on web"), { code: "google-on-web" });
  const { GoogleSignin, isSuccessResponse } = require("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw Object.assign(new Error("Cancelled"), { code: "cancelled" });
  await GoogleSignin.signOut();
  // A different Google account than this one fails here with "auth/user-mismatch".
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(response.data.idToken));
};

// Step 2: the "deleted" mark and clearing the contact details. Skipped when finishing a deletion that stopped halfway.
export const markProfileDeleted = async () => {
  const user = auth.currentUser;
  await updateDoc(doc(db, "users", user.uid), {
    deletedAt: serverTimestamp(),
    phone: deleteField(),
    phoneNumber: deleteField(),
    address: deleteField(),
    profilePhoto: deleteField(),
    profilePhotoUrl: deleteField(),
    photoURL: deleteField(),
    avatarUrl: deleteField(),
    updatedAt: serverTimestamp(),
  });
};

// Step 3: delete the login. After this the person is signed out.
export const deleteOwnLogin = async () => {
  await deleteUser(auth.currentUser);
};

// Words for the person when something goes wrong ("" = say nothing, for example they closed the Google picker).
export const getDeleteErrorMessage = (error) => {
  switch (error?.code) {
    case "cancelled":
      return "";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "That password is not right. Please try again.";
    case "auth/user-mismatch":
      return "That is a different Google account. Choose the one you use for SakayNa.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "No internet connection. Check your connection and try again.";
    case "auth/requires-recent-login":
      return "Please confirm it is you again, then try again.";
    case "google-on-web":
      return "This account uses Google. Open the SakayNa app on your phone to delete it.";
    default:
      return "Your account could not be deleted. Please try again.";
  }
};
