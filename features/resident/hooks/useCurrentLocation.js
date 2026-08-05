import { useCallback, useState } from "react";
import * as Location from "expo-location";

const toAddress = (place, latitude, longitude) => {
  if (!place) return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  return [place.name, place.street, place.district, place.city, place.region].filter(Boolean).join(", ") || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

export default function useCurrentLocation() {
  const [locating, setLocating] = useState(false);

  const detectLocation = useCallback(async () => {
    setLocating(true);
    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();
      const permission = existingPermission.granted ? existingPermission : await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        return { error: permission.canAskAgain === false ? "Location permission is blocked in device settings. You can still enter a location manually." : "Location permission was not granted. You can still enter a location manually." };
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return { error: "Location services are turned off. You can still enter a location manually." };

      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
      const { latitude, longitude } = position.coords;
      let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      let barangay = null;
      let geocodeWarning = "";
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        address = toAddress(places[0], latitude, longitude);
        barangay = places[0]?.district || places[0]?.subregion || null;
      } catch {
        geocodeWarning = "Coordinates were found, but the address could not be looked up. Please add a landmark.";
      }

      return { location: { latitude, longitude, address, barangay, source: "gps" }, warning: geocodeWarning };
    } catch (error) {
      return { error: error?.message === "timeout" ? "GPS took too long to respond. You can enter or pin the pickup location manually." : "Your location could not be detected. You can enter or pin the pickup location manually." };
    } finally {
      setLocating(false);
    }
  }, []);

  return { locating, detectLocation };
}
