import * as Location from "expo-location";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

import { db } from "../../../firebase";
import { getLocationIfAllowed } from "../../resident/hooks/useCurrentLocation";

// The driver's last known location (driver-location-plan.md).
// One driverLocations/{driverUid} document per driver, like a sticky note:
// each step replaces it, and punching out erases it. Never saved in the background.
// firestore.rules checks the driver is on duty, the step is one of the five, and the time is Firestore's.

// Stop waiting for the GPS after 8 seconds. Only use a position from the last minute (the van moves).
const GPS_WAIT_MS = 8000;
const FRESH_MS = 60 * 1000;

// Reads the phone's location once and saves it with the step ("Punch in", "Accepted", "En Route", "Arrived", "Picked Up").
// Called AFTER the step itself is saved, and never waited for, so the step never waits for the GPS.
// It never shows a pop-up and never fails out loud: not allowed, GPS off, too slow, or the website = nothing is saved.
export const saveDriverLocation = async ({ driverId, step }) => {
  if (!driverId) return;
  try {
    const coordinates = await getLocationIfAllowed(GPS_WAIT_MS, FRESH_MS);
    if (!coordinates) return;
    await setDoc(doc(db, "driverLocations", driverId), {
      latitude: coordinates[0],
      longitude: coordinates[1],
      step,
      at: serverTimestamp(),
    });
  } catch (error) {
    console.log("Driver location save warning:", error);
  }
};

// Punch in only (never in the middle of a ride): shows Android's location pop-up if the driver
// hasn't said yes yet and Android still lets us ask, then saves the "Punch in" location.
// After two "Don't allow" answers Android stops showing the pop-up by itself.
export const shareLocationAtPunchIn = async ({ driverId }) => {
  if (Platform.OS === "web") return;
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      await Location.requestForegroundPermissionsAsync();
    }
  } catch (error) {
    console.log("Driver location permission warning:", error);
  }
  await saveDriverLocation({ driverId, step: "Punch in" });
};

// Punch out: throw the sticky note away. If this fails, punching out still worked
// (and the dispatcher doesn't show an Off duty driver's location anyway).
export const eraseDriverLocation = async ({ driverId }) => {
  if (!driverId) return;
  try {
    await deleteDoc(doc(db, "driverLocations", driverId));
  } catch (error) {
    console.log("Driver location erase warning:", error);
  }
};
