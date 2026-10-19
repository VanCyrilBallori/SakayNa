import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LeafletMap from "../../../components/LeafletMap";
import AppButton from "../../../components/ui/AppButton";
import CloseButton from "../../../components/ui/CloseButton";
import { CORNER, FONT, GREEN, NEUTRAL, SHADOW, SPACING } from "../../../constants/design";
import { getLocationIfAllowed } from "../hooks/useCurrentLocation";

const toCoordinateAddress = (location) => `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

export default function MapLocationModal({ visible, initialLocation, onClose, onConfirm }) {
  const [selected, setSelected] = useState(initialLocation || null);
  const [address, setAddress] = useState(initialLocation?.address || "");
  // Where the map starts when no pin is placed yet.
  // undefined = still checking, null = the Poblacion (the map's default), [lat, lng] = the resident's location.
  const [startCenter, setStartCenter] = useState(undefined);
  // Android draws this window behind its own bottom bar (◁ ○ □), so leave that much room at the bottom (Task 3.17).
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setSelected(initialLocation || null);
      setAddress(initialLocation?.address || "");
    }
  }, [initialLocation, visible]);

  // 1. A pin is already placed: the map opens on that pin, so nothing to check.
  // 2. Otherwise the resident's location, only if already allowed (no permission pop-up here).
  // 3. Otherwise null: the map opens on the Poblacion.
  // The map waits for this (at most about 4 seconds), so it doesn't jump after it opens.
  useEffect(() => {
    if (!visible) return undefined;
    if (initialLocation) {
      setStartCenter(null);
      return undefined;
    }

    let cancelled = false;
    setStartCenter(undefined);
    getLocationIfAllowed().then((center) => {
      if (!cancelled) setStartCenter(center);
    });
    return () => {
      cancelled = true;
    };
  }, [initialLocation, visible]);

  const selectLocation = ({ latitude, longitude }) => {
    const next = { latitude, longitude, source: "map", barangay: null };
    setSelected(next);
    setAddress((current) => current.trim() || toCoordinateAddress(next));
  };

  const confirm = () => {
    if (!selected) return;
    onConfirm({ ...selected, address: address.trim() || toCoordinateAddress(selected) });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* A bottom sheet (DESIGN.md Style): 24 top corners, a grabber bar, Level 3 shadow. */}
        <View style={[styles.card, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerCopy}><Text style={styles.title}>Pin Pickup Location</Text><Text style={styles.subtitle}>Tap the map to place the pickup marker, then confirm it.</Text></View>
            <CloseButton onPress={onClose} label="Close map picker" />
          </View>
          <View style={styles.map}>
            {startCenter === undefined ? (
              <View style={styles.mapLoading}><ActivityIndicator color={GREEN[600]} /><Text style={styles.mapLoadingText}>Opening the map…</Text></View>
            ) : (
              <LeafletMap title="Select pickup location" markerLabel="Pickup location" pickupCoordinates={selected ? [selected.latitude, selected.longitude] : null} centerCoordinates={startCenter} selectable onLocationSelect={selectLocation} />
            )}
          </View>
          <Text style={styles.coordinate}>{selected ? `Selected: ${toCoordinateAddress(selected)}` : "Tap the map to select a location."}</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Address or landmark (map fallback)" placeholderTextColor={NEUTRAL[600]} maxLength={180} />
          <Text style={styles.hint}>If the map does not load, close this window and enter the barangay and landmark manually.</Text>
          <View style={styles.actions}><AppButton label="Cancel" variant="secondary" onPress={onClose} style={styles.button} /><AppButton label="Confirm pin" disabled={!selected} onPress={confirm} style={styles.button} /></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20, 33, 28, 0.55)" },
  card: { maxHeight: "92%", paddingHorizontal: SPACING.lg, backgroundColor: NEUTRAL[0], borderTopLeftRadius: CORNER.sheet, borderTopRightRadius: CORNER.sheet, ...SHADOW.level3 },
  grabber: { alignSelf: "center", width: 40, height: 5, marginTop: 10, marginBottom: 6, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[300] },
  header: { flexDirection: "row", gap: SPACING.md, justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACING.md },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  subtitle: { marginTop: 4, fontSize: 15, lineHeight: 20, fontFamily: FONT.regular, color: NEUTRAL[700] },
  headerCopy: { flex: 1, paddingTop: 6 },
  map: { height: 320, overflow: "hidden", borderRadius: CORNER.card, borderWidth: 1, borderColor: NEUTRAL[200] },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  mapLoadingText: { fontSize: 15, fontFamily: FONT.regular, color: NEUTRAL[700] },
  coordinate: { marginTop: SPACING.sm, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  input: { minHeight: 48, marginTop: SPACING.sm, paddingHorizontal: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0], fontSize: 17, fontFamily: FONT.regular, color: NEUTRAL[900] },
  hint: { marginTop: SPACING.sm, fontSize: 15, lineHeight: 20, fontFamily: FONT.regular, color: NEUTRAL[700] },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  button: { flex: 1, minHeight: 56 },
});
