import * as IntentLauncher from "expo-intent-launcher";
import { Linking, PermissionsAndroid, Platform } from "react-native";

// The one place every Call button goes through. Only call this from a button the user tapped.
// On Android with the phone call permission, the call starts right away.
// Otherwise (web, permission denied, or any error) the phone's dialer opens with the number filled in.
export async function startPhoneCall(phone) {
  const telUrl = `tel:${String(phone).replace(/\s+/g, "")}`;

  if (Platform.OS === "android") {
    try {
      const allowed = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
      if (allowed) {
        await IntentLauncher.startActivityAsync("android.intent.action.CALL", { data: telUrl });
        return;
      }
    } catch (error) {
      console.log("Direct call warning:", error);
    }
  }

  Linking.openURL(telUrl).catch((error) => console.log("Phone dialer warning:", error));
}
