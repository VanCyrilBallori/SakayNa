import { Entypo, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { db } from "../firebase";
import { useCurrentUserProfile } from "../lib/session";

export default function DriverHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const [availability, setAvailability] = useState("Unavailable");
  const [assignedTransfer, setAssignedTransfer] = useState(null);

  useEffect(() => {
    if (!authUser?.uid) {
      return undefined;
    }

    const userRef = doc(db, "users", authUser.uid);

    setDoc(
      userRef,
      {
        email: authUser.email ?? profile?.email ?? "",
        fullName: profile?.fullName ?? displayName,
        role: "Driver",
      },
      { merge: true }
    ).catch((error) => console.log("Driver availability setup warning:", error));

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data();
        setAvailability(data?.availability ?? "Unavailable");
      },
      (error) => console.log("Driver availability listener warning:", error)
    );

    return unsubscribe;
  }, [authUser?.uid, authUser?.email, displayName, profile?.email, profile?.fullName]);

  useEffect(() => {
    if (!authUser?.uid) {
      setAssignedTransfer(null);
      return undefined;
    }

    const assignmentsQuery = query(collection(db, "driverAssignments"), where("driverId", "==", authUser.uid), where("status", "==", "Assigned"));
    const unsubscribe = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        const assignments = snapshot.docs.map((assignmentDoc) => ({
          id: assignmentDoc.id,
          ...assignmentDoc.data(),
        }));

        setAssignedTransfer(assignments[0] ?? null);
      },
      (error) => console.log("Driver assignment listener warning:", error)
    );

    return unsubscribe;
  }, [authUser?.uid]);

  const toggleAvailability = async () => {
    if (!authUser?.uid) {
      return;
    }

    const nextAvailability = availability === "Available" ? "Unavailable" : "Available";
    setAvailability(nextAvailability);

    try {
      await setDoc(doc(db, "users", authUser.uid), {
        availability: nextAvailability,
      }, { merge: true });
    } catch (error) {
      console.log("Driver availability update failed:", error);
    }
  };

  const request = assignedTransfer?.request;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppBrandHeader role="Driver" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.statusBar, availability === "Unavailable" && styles.statusBarUnavailable]}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, availability === "Unavailable" && styles.statusDotUnavailable]} />
            <View>
              <Text style={[styles.statusText, compact && styles.statusTextCompact]}>{availability}</Text>
              <Text style={styles.statusSubtext}>Set your dispatch status manually</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggleSwitch, availability === "Available" && styles.toggleSwitchOn]}
            onPress={toggleAvailability}
            activeOpacity={0.85}
          >
            <View style={[styles.toggleKnob, availability === "Available" && styles.toggleKnobOn]} />
          </TouchableOpacity>
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.assignmentPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Patient Transfer Inbox</Text>
              </View>
              <Text style={styles.assignmentStatus}>{assignedTransfer ? "Assigned request" : "No assigned task"}</Text>
            </View>

            <Text style={[styles.assignmentTitle, compact && styles.assignmentTitleCompact]}>Patient Transfer</Text>

            {request ? (
              <View style={styles.assignmentGrid}>
                <View style={styles.leftColumn}>
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Pickup Location</Text>
                    <View style={styles.locationRow}>
                      <Entypo name="location-pin" size={26} color="#111111" />
                      <Text style={styles.locationText}>{request.pickupLocation}</Text>
                    </View>
                  </View>

                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Destination</Text>
                    <View style={styles.locationRow}>
                      <FontAwesome5 name="flag" size={20} color="#111111" />
                      <Text style={styles.locationText}>{request.destination}</Text>
                    </View>
                  </View>

                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Trip Summary</Text>
                    <Text style={styles.summaryText}>{request.summary}</Text>
                    <Text style={styles.requestMeta}>{request.level} | {request.vehicle} | {request.barangay}</Text>
                  </View>
                </View>

                <View style={styles.mapCard}>
                  <View style={styles.mapCardHeader}>
                    <Text style={styles.mapCardTitle}>{request.title}</Text>
                    <View style={styles.mapHeaderButton}>
                      <Text style={styles.mapHeaderButtonText}>Assigned</Text>
                    </View>
                  </View>

                  <View style={styles.mapBlankState}>
                    <MaterialCommunityIcons name="map-outline" size={56} color="#90A0AA" />
                    <Text style={styles.mapBlankTitle}>Route preview</Text>
                    <Text style={styles.mapBlankText}>The assigned request from the dispatcher appears here like a received inbox message.</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyInbox}>
                <MaterialCommunityIcons name="email-outline" size={54} color="#8EA098" />
                <Text style={styles.emptyTitle}>Inbox empty</Text>
                <Text style={styles.emptyText}>Assigned patient transfer tasks from dispatch will appear here.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 24 },
  container: { width: "100%", maxWidth: 1280, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 16 },
  statusBar: {
    backgroundColor: "#0B7A4A",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  statusBarUnavailable: { backgroundColor: "#647067" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 220 },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#20F48B" },
  statusDotUnavailable: { backgroundColor: "#C8D0CC" },
  statusText: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  statusTextCompact: { fontSize: 21 },
  statusSubtext: { marginTop: 2, fontSize: 13, color: "#D8EEE3" },
  toggleSwitch: {
    width: 72,
    height: 38,
    borderRadius: 19,
    padding: 4,
    backgroundColor: "#D6DEDA",
    justifyContent: "center",
  },
  toggleSwitchOn: { backgroundColor: "#B9F5D2" },
  toggleKnob: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF" },
  toggleKnobOn: { alignSelf: "flex-end", backgroundColor: "#06774B" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  assignmentPanel: { flex: 3, minWidth: 280, padding: 20, borderRadius: 24, backgroundColor: "#E3E7E5" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  badge: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "#FB7A2E" },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  assignmentStatus: { fontSize: 14, fontWeight: "700", color: "#567167" },
  assignmentTitle: { marginTop: 14, fontSize: 38, fontWeight: "800", color: "#111111" },
  assignmentTitleCompact: { fontSize: 30 },
  assignmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "stretch" },
  leftColumn: { flex: 1, minWidth: 260, gap: 14 },
  infoCard: { padding: 18, borderRadius: 20, backgroundColor: "#FFFFFF" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111111" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  locationText: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1C2723" },
  summaryText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#475652" },
  requestMeta: { marginTop: 12, fontSize: 13, fontWeight: "700", color: "#60716B" },
  mapCard: { flex: 1.05, minWidth: 280, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEDA", overflow: "hidden" },
  mapCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E4EBE7", gap: 12, flexWrap: "wrap" },
  mapCardTitle: { fontSize: 18, fontWeight: "700", color: "#2E3C37" },
  mapHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  mapHeaderButtonText: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  mapBlankState: { minHeight: 280, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 },
  mapBlankTitle: { marginTop: 14, fontSize: 24, fontWeight: "800", color: "#2F3B46", textAlign: "center" },
  mapBlankText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  emptyInbox: { marginTop: 20, minHeight: 300, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#2F3B46" },
  emptyText: { marginTop: 8, maxWidth: 360, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
});
