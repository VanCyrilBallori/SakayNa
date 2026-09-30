import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

// Finds the resident's position for the home map. It NEVER asks for permission on its own:
// it only uses location if the resident already allowed it. Only allowLocation() (a button the
// resident tapped) may show the permission pop-up.
//
// status tells the home screen what to show:
//   "found"    = coordinates are ready ([latitude, longitude])
//   "checking" = the first check is still running
//   "waiting"  = permission never answered yet (the first-login pop-up may be open right now)
//   "denied"   = permission not allowed (blocked = true if Android won't show the pop-up again)
//   "gps-off"  = the phone's Location (GPS) switch is off
//   "error"    = GPS too slow or another problem
//   "web"      = the website: the home map doesn't use location there
export default function useHomeLocation() {
  const [status, setStatus] = useState(Platform.OS === "web" ? "web" : "checking");
  const [coordinates, setCoordinates] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  // Each check gets a number. Only the newest check may change the screen, so a slow old check can't overwrite a newer answer.
  const latestCheck = useRef(0);

  const check = useCallback(async () => {
    if (Platform.OS === "web") return;
    const checkNumber = latestCheck.current + 1;
    latestCheck.current = checkNumber;
    const isNewest = () => checkNumber === latestCheck.current;
    setChecking(true);

    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!isNewest()) return;
      setBlocked(permission.canAskAgain === false);
      if (!permission.granted) {
        setCoordinates(null);
        setStatus(permission.status === "undetermined" ? "waiting" : "denied");
        return;
      }

      const gpsOn = await Location.hasServicesEnabledAsync();
      if (!isNewest()) return;
      if (!gpsOn) {
        setCoordinates(null);
        setStatus("gps-off");
        return;
      }

      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
      if (!isNewest()) return;
      // Rounded to about 10 meters. If the spot didn't really change, keep the old one so the map doesn't reload.
      const latitude = Number(position.coords.latitude.toFixed(4));
      const longitude = Number(position.coords.longitude.toFixed(4));
      setCoordinates((current) => (current && current[0] === latitude && current[1] === longitude ? current : [latitude, longitude]));
      setStatus("found");
    } catch (error) {
      console.log("Home location warning:", error);
      if (!isNewest()) return;
      setCoordinates(null);
      setStatus("error");
    } finally {
      if (isNewest()) setChecking(false);
    }
  }, []);

  // Check when the home screen opens, and again every time the resident comes back to the app
  // (for example after allowing location or turning on GPS in the phone's Settings).
  useEffect(() => {
    check();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") check();
    });
    return () => subscription.remove();
  }, [check]);

  // The "Allow location" button. If Android can still ask, show the permission pop-up.
  // If the permission is blocked, open SakayNa's page in the phone's Settings instead.
  const allowLocation = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.canAskAgain) {
        await Location.requestForegroundPermissionsAsync();
        check();
        return;
      }
    } catch (error) {
      console.log("Location permission warning:", error);
    }
    // Coming back from Settings counts as "coming back to the app", so the check above runs again by itself.
    Linking.openSettings().catch((error) => console.log("Open settings warning:", error));
  }, [check]);

  return { status, coordinates, blocked, checking, retry: check, allowLocation };
}
