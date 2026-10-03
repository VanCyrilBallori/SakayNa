import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import LeafletMap from "../../../components/LeafletMap";
import AppButton from "../../../components/ui/AppButton";
import { COLORS, RADIUS, SPACING } from "../../../constants/design";
import { getLocationIfAllowed } from "../hooks/useCurrentLocation";

const toCoordinateAddress = (location) => `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

export default function MapLocationModal({ visible, initialLocation, onClose, onConfirm }) {
  const [selected, setSelected] = useState(initialLocation || null);
  const [address, setAddress] = useState(initialLocation?.address || "");
  // Where the map starts when no pin is placed yet.
  // undefined = still checking, null = the Poblacion (the map's default), [lat, lng] = the resident's location.
  const [startCenter, setStartCenter] = useState(undefined);

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
        <View style={styles.card}>
          <View style={styles.header}>
            <View><Text style={styles.title}>Pin Pickup Location</Text><Text style={styles.subtitle}>Tap the map to place the pickup marker, then confirm it.</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close map picker" onPress={onClose} style={styles.close}><Text style={styles.closeText}>X</Text></TouchableOpacity>
          </View>
          <View style={styles.map}>
            {startCenter === undefined ? (
              <View style={styles.mapLoading}><ActivityIndicator color={COLORS.primary} /><Text style={styles.mapLoadingText}>Opening the map…</Text></View>
            ) : (
              <LeafletMap title="Select pickup location" markerLabel="Pickup location" pickupCoordinates={selected ? [selected.latitude, selected.longitude] : null} centerCoordinates={startCenter} selectable onLocationSelect={selectLocation} />
            )}
          </View>
          <Text style={styles.coordinate}>{selected ? `Selected: ${toCoordinateAddress(selected)}` : "Tap the map to select a location."}</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Address or landmark (map fallback)" placeholderTextColor={COLORS.subtleText} maxLength={180} />
          <Text style={styles.hint}>If the map does not load, close this window and enter the barangay and landmark manually.</Text>
          <View style={styles.actions}><AppButton label="Cancel" variant="secondary" onPress={onClose} style={styles.button} /><AppButton label="Confirm pin" disabled={!selected} onPress={confirm} style={styles.button} /></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13, 31, 24, 0.62)" },
  card: { maxHeight: "92%", padding: SPACING.lg, backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
  header: { flexDirection: "row", gap: SPACING.md, justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACING.md },
  title: { fontSize: 21, fontWeight: "800", color: COLORS.text }, subtitle: { maxWidth: 290, marginTop: 4, color: COLORS.mutedText, lineHeight: 20 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, closeText: { fontWeight: "800", fontSize: 17, color: COLORS.text },
  map: { height: 320, overflow: "hidden", borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm }, mapLoadingText: { color: COLORS.mutedText, fontSize: 15 }, coordinate: { marginTop: SPACING.sm, color: COLORS.mutedText, fontSize: 13 },
  input: { minHeight: 48, marginTop: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, color: COLORS.text },
  hint: { marginTop: SPACING.sm, color: COLORS.mutedText, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }, button: { flex: 1 },
});
