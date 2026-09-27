import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { PermissionsAndroid, Platform } from "react-native";

const NOTIFICATIONS_ASKED_KEY = "sakayna-notifications-asked";
const CALL_PHONE_ASKED_KEY = "sakayna-call-phone-asked";

// The gatekeeper can let a user through many times while the app is open; this runs the checks only once.
let askedThisAppRun = false;

// Called by components/AuthRouteGate.jsx when a Resident reaches their home screen on the phone app.
// Each pop-up shows only once per install, so later logins skip them.
// "Don't allow" or an error just moves on to the next step; the app never gets stuck here.
export async function askResidentPermissionsOnce() {
  if (askedThisAppRun) {
    return;
  }
  askedThisAppRun = true;

  try {
    const notifications = await Notifications.getPermissionsAsync();
    // On Android 13+ a never-asked notification permission reports "denied", not "undetermined",
    // so a saved flag remembers whether the app already asked.
    const alreadyAsked = await AsyncStorage.getItem(NOTIFICATIONS_ASKED_KEY);
    if (notifications.status !== "granted" && notifications.canAskAgain && !alreadyAsked) {
      await AsyncStorage.setItem(NOTIFICATIONS_ASKED_KEY, "yes");
      // Android 13+ only shows the notification pop-up after a notification channel exists.
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      await Notifications.requestPermissionsAsync();
    }
  } catch (error) {
    console.log("Notification permission warning:", error);
  }

  try {
    const location = await Location.getForegroundPermissionsAsync();
    if (location.status === "undetermined") {
      await Location.requestForegroundPermissionsAsync();
    }
  } catch (error) {
    console.log("Location permission warning:", error);
  }

  // Lets a Call button start the call directly (see lib/phoneCall.js). PermissionsAndroid can't
  // tell "never asked" from "said no", so a saved flag remembers whether the app already asked.
  if (Platform.OS === "android") {
    try {
      const allowed = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
      const alreadyAsked = await AsyncStorage.getItem(CALL_PHONE_ASKED_KEY);
      if (!allowed && !alreadyAsked) {
        await AsyncStorage.setItem(CALL_PHONE_ASKED_KEY, "yes");
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
      }
    } catch (error) {
      console.log("Phone call permission warning:", error);
    }
  }
}
