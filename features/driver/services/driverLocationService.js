import * as Location from "expo-location";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

import { db } from "../../../firebase";
import { getLocationIfAllowed } from "../../resident/hooks/useCurrentLocation";

// The driver's last known location (driver-location-plan.md).
// One driverLocations/{driverUid} document per driver, like a sticky note:
// each step replaces it, and punching out erases it. Never saved in the background.
// While SakayNa is open and the driver is on duty (not on break), it is also refreshed now and then (live updates, below).
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

// ---- Live updates while SakayNa is open (ROADMAP Task 3.20 Step A) ----
// Every 15 seconds the phone checks where it is. It saves only if the driver moved 20 meters or more
// since the last save, or if 60 seconds passed without a save (standing still). This keeps battery
// and Firestore's free quota low. It uses the same five step names, so firestore.rules is unchanged.
const LIVE_CHECK_MS = 15 * 1000;
const LIVE_MOVE_METERS = 20;
const LIVE_STILL_MS = 60 * 1000;

// Straight-line distance in meters between two [latitude, longitude] points (haversine formula).
const metersBetween = ([lat1, lng1], [lat2, lng2]) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// GPS reading for live updates: "High" accuracy (real GPS), so a parked van doesn't look like it moved 20 m.
// Only if location is already allowed; never shows a pop-up. Gives up after 8 seconds.
const readLivePosition = async () => {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise((resolve) => setTimeout(() => resolve(null), GPS_WAIT_MS)),
  ]);
  return position ? [position.coords.latitude, position.coords.longitude] : null;
};

// Starts the live updates. getStep() returns the step name to save right now ("Punch in" or the ride's step).
// Returns a stop function. driver-home.jsx calls stop when the app leaves the screen, on break, or at punch out.
export const startLiveLocation = ({ driverId, getStep }) => {
  if (Platform.OS === "web" || !driverId) return () => {};
  let lastSaved = null; // { coordinates, atMs } of the last live save
  let checking = false;

  const check = async () => {
    if (checking) return; // the last GPS reading is still running
    checking = true;
    try {
      const coordinates = await readLivePosition();
      if (!coordinates) return;
      const now = Date.now();
      const moved = !lastSaved || metersBetween(lastSaved.coordinates, coordinates) >= LIVE_MOVE_METERS;
      const stillTooLong = !lastSaved || now - lastSaved.atMs >= LIVE_STILL_MS;
      if (!moved && !stillTooLong) return;
      await setDoc(doc(db, "driverLocations", driverId), {
        latitude: coordinates[0],
        longitude: coordinates[1],
        step: getStep(),
        at: serverTimestamp(),
      });
      lastSaved = { coordinates, atMs: now };
    } catch (error) {
      // GPS off, no signal, or refused by the rules (for example just after punch out): try again next time.
      console.log("Driver live location warning:", error);
    } finally {
      checking = false;
    }
  };

  const timer = setInterval(check, LIVE_CHECK_MS);
  return () => clearInterval(timer);
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
