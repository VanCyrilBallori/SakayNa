import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { MISSION_STATUSES } from "../../../constants/app";
import { DESIGN_COLORS } from "../../../constants/design";
import { getDestinationCoordinates, getDestinationLabel, getPickupCoordinates, getPickupLabel } from "../utils/driverMissionMapper";

// One navigation button that follows the ride step (driver-home-restyle-plan.md Piece 4a):
// the pickup until "Picked up", then the destination. It opens Google Maps.
// On the Map page since driver-pages-plan.md Step 1 (it was in DriverMissionActions.jsx before).
// request = the ride. status = the ride step (getMissionStatus).
export default function DriverNavigateButton({ request, status }) {
  const [warning, setWarning] = useState("");
  const toDestination = status === MISSION_STATUSES.PICKED_UP;

  const openMap = async () => {
    const coordinates = toDestination ? getDestinationCoordinates(request) : getPickupCoordinates(request);
    const address = toDestination ? getDestinationLabel(request) : getPickupLabel(request);
    // The exact pin if there is one, otherwise the address words.
    const target = coordinates
      ? `https://www.google.com/maps/search/?api=1&query=${coordinates[0]},${coordinates[1]}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    setWarning("");
    try {
      if (await Linking.canOpenURL(target)) await Linking.openURL(target);
      else setWarning("A maps application is not available on this device.");
    } catch {
      setWarning("The map link could not be opened.");
    }
  };

  return (
    <View>
      <Pressable style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]} onPress={openMap} accessibilityRole="button">
        <MaterialCommunityIcons name="navigation-variant-outline" size={24} color={DESIGN_COLORS.hallGreen} />
        <Text style={styles.navButtonText}>{toDestination ? "Navigate to destination" : "Navigate to pickup"}</Text>
      </Pressable>
      <FeedbackMessage message={warning} tone="warning" />
    </View>
  );
}

const styles = StyleSheet.create({
  // White with a grey-green edge, 56 tall (same look as before the move).
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  navButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  navButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
});
