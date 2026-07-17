import { Entypo, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import LeafletMap from "../components/LeafletMap";
import { db } from "../firebase";
import { useCurrentUserProfile } from "../lib/session";

export default function DriverHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const [accessStatus, setAccessStatus] = useState("checking");
  const [availability, setAvailability] = useState("Unavailable");
  const [assignedTransfer, setAssignedTransfer] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (!authUser?.uid) {
      router.replace("/login");
      return undefined;
    }

    getDoc(doc(db, "users", authUser.uid))
      .then((snapshot) => {
        const data = snapshot.data();

        if (data?.role === "Driver" && data?.accountStatus === "Approved") {
          setAccessStatus("approved");
          return;
        }

        router.replace("/driver-status");
      })
      .catch((error) => {
        console.log("Driver access check warning:", error);
        router.replace("/driver-status");
      });

    return undefined;
  }, [authUser?.uid, router]);

  useEffect(() => {
    if (!authUser?.uid || accessStatus !== "approved") {
      return undefined;
    }

    const userRef = doc(db, "users", authUser.uid);

    setDoc(
      userRef,
      {
        availability: "Available",
        presence: "Online",
        email: authUser.email ?? profile?.email ?? "",
        fullName: profile?.fullName ?? displayName,
        role: "Driver",
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => console.log("Driver availability setup warning:", error));
    setAvailability("Available");

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data();
        setAvailability(data?.availability ?? "Unavailable");
      },
      (error) => console.log("Driver availability listener warning:", error)
    );

    const markUnavailable = () => {
      setDoc(
        userRef,
        {
          availability: "Unavailable",
          presence: "Offline",
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((error) => console.log("Driver offline update warning:", error));
    };

    const markAvailable = () => {
      setDoc(
        userRef,
        {
          availability: "Available",
          presence: "Online",
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((error) => console.log("Driver online update warning:", error));
    };

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        markAvailable();
        return;
      }

      markUnavailable();
    });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", markAvailable);
      window.addEventListener("offline", markUnavailable);
      window.addEventListener("beforeunload", markUnavailable);
    }

    return () => {
      unsubscribe();
      appStateSubscription.remove();

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", markAvailable);
        window.removeEventListener("offline", markUnavailable);
        window.removeEventListener("beforeunload", markUnavailable);
      }

      markUnavailable();
    };
  }, [accessStatus, authUser?.uid, authUser?.email, displayName, profile?.email, profile?.fullName]);

  useEffect(() => {
    if (!authUser?.uid || accessStatus !== "approved") {
      setAssignedTransfer(null);
      return undefined;
    }

    const assignmentsQuery = query(collection(db, "driverAssignments"), where("driverId", "==", authUser.uid));
    const unsubscribe = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        const assignments = snapshot.docs
          .map((assignmentDoc) => ({
            id: assignmentDoc.id,
            ...assignmentDoc.data(),
          }))
          .filter((assignment) => ["Assigned", "In Progress"].includes(assignment.status));

        setAssignedTransfer(assignments[0] ?? null);
      },
      (error) => console.log("Driver assignment listener warning:", error)
    );

    return unsubscribe;
  }, [accessStatus, authUser?.uid]);

  const updateMissionStatus = async (nextStatus) => {
    if (!assignedTransfer?.id) {
      return;
    }

    const requestId = assignedTransfer.requestId;

    try {
      await updateDoc(doc(db, "driverAssignments", assignedTransfer.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      if (requestId) {
        await updateDoc(doc(db, "transportRequests", requestId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.log("Mission status update failed:", error);
    }
  };

  const declineMission = async () => {
    if (!assignedTransfer?.id) {
      return;
    }

    try {
      await updateDoc(doc(db, "driverAssignments", assignedTransfer.id), {
        status: "Declined",
        updatedAt: serverTimestamp(),
      });

      if (assignedTransfer.requestId) {
        await updateDoc(doc(db, "transportRequests", assignedTransfer.requestId), {
          status: "Pending",
          lastDeclinedDriverId: authUser?.uid ?? "",
          lastDeclinedDriverName: displayName,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.log("Mission decline failed:", error);
    }
  };

  const request = assignedTransfer?.request;
  const missionStatus = assignedTransfer?.status ?? "Assigned";

  if (accessStatus !== "approved") {
    return (
      <View style={styles.accessPage}>
        <ActivityIndicator color="#06774B" />
        <Text style={styles.accessText}>Checking driver access...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppBrandHeader role="Driver" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.statusBar, availability === "Unavailable" && styles.statusBarUnavailable]}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, availability === "Unavailable" && styles.statusDotUnavailable]} />
            <View>
              <Text style={[styles.statusText, compact && styles.statusTextCompact]}>{availability}</Text>
              <Text style={styles.statusSubtext}>{availability === "Available" ? "Online and ready for dispatch" : "Offline or inactive"}</Text>
            </View>
          </View>
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
                  <View style={styles.missionCard}>
                    <View style={styles.missionCardTop}>
                      <Text style={styles.missionEyebrow}>Current Mission</Text>
                      <View style={styles.missionStatusPill}>
                        <Text style={styles.missionStatusText}>{missionStatus}</Text>
                      </View>
                    </View>
                    <Text style={styles.missionTitle}>{request.emergencyType ?? request.title}</Text>
                    <Text style={styles.missionText}>
                      Patient: {request.patientName ?? request.residentName ?? assignedTransfer.residentName ?? "Not provided"}
                    </Text>
                    <Text style={styles.missionText}>Request: {request.summary}</Text>
                  </View>

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
                    <Text style={styles.requestMeta}>{request.level} | {request.emergencyType ?? request.title} | {request.vehicle}</Text>
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
                    <LeafletMap title="Driver Route Preview Map" markerLabel="Toledo City route preview" />
                  </View>

                  <View style={styles.driverActionRow}>
                    {missionStatus === "Assigned" ? (
                      <>
                        <TouchableOpacity style={[styles.driverActionButton, styles.acceptButton]} onPress={() => updateMissionStatus("In Progress")}>
                          <Text style={styles.driverActionButtonText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.driverActionButton, styles.declineButton]} onPress={declineMission}>
                          <Text style={styles.driverActionButtonText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.driverActionButton, styles.reviewButton]} onPress={() => setReviewOpen(true)}>
                          <Text style={styles.driverActionButtonText}>Review</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={[styles.driverActionButton, styles.completeButton]} onPress={() => updateMissionStatus("Completed")}>
                        <Text style={styles.driverActionButtonText}>Complete Job</Text>
                      </TouchableOpacity>
                    )}
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
      <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => setReviewOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.reviewCard, compact && styles.reviewCardCompact]}>
            <Text style={styles.reviewTitle}>Mission Details</Text>
            <Text style={styles.reviewLine}>Patient: {request?.patientName ?? request?.residentName ?? assignedTransfer?.residentName ?? "Not provided"}</Text>
            <Text style={styles.reviewLine}>Request: {request?.emergencyType ?? request?.title ?? "Transport Request"}</Text>
            <Text style={styles.reviewLine}>Pickup: {request?.pickupLocation ?? "Pickup location pending"}</Text>
            <Text style={styles.reviewLine}>Destination: {request?.destination ?? "Nearest available response center"}</Text>
            <Text style={styles.reviewLine}>Vehicle: {request?.vehicle ?? "Available Vehicle"}</Text>
            <TouchableOpacity style={styles.reviewCloseButton} onPress={() => setReviewOpen(false)}>
              <Text style={styles.reviewCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  accessPage: { flex: 1, backgroundColor: "#F5F7F6", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  accessText: { fontSize: 15, fontWeight: "800", color: "#335E50", textAlign: "center" },
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
  missionCard: { padding: 18, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E2DD" },
  missionCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  missionEyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: "#5A7267" },
  missionStatusPill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#EAF4EF" },
  missionStatusText: { fontSize: 12, fontWeight: "800", color: "#06774B" },
  missionTitle: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#111111" },
  missionText: { marginTop: 8, fontSize: 15, lineHeight: 22, color: "#475652" },
  infoCard: { padding: 18, borderRadius: 20, backgroundColor: "#FFFFFF" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111111" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  locationText: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1C2723" },
  summaryText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#475652" },
  requestMeta: { marginTop: 12, fontSize: 13, fontWeight: "700", color: "#60716B" },
  mapCard: { flex: 0.82, minWidth: 280, maxWidth: 460, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEDA", overflow: "hidden" },
  mapCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E4EBE7", gap: 12, flexWrap: "wrap" },
  mapCardTitle: { fontSize: 18, fontWeight: "700", color: "#2E3C37" },
  mapHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  mapHeaderButtonText: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  mapBlankState: { minHeight: 280, aspectRatio: 1, alignItems: "stretch", justifyContent: "flex-start" },
  mapBlankTitle: { marginTop: 14, fontSize: 24, fontWeight: "800", color: "#2F3B46", textAlign: "center" },
  mapBlankText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  driverActionRow: { padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 10, borderTopWidth: 1, borderTopColor: "#E4EBE7" },
  driverActionButton: { flexGrow: 1, minWidth: 120, minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  acceptButton: { backgroundColor: "#06774B" },
  declineButton: { backgroundColor: "#C53A3A" },
  reviewButton: { backgroundColor: "#326CD0" },
  completeButton: { backgroundColor: "#FB7A2E" },
  driverActionButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  emptyInbox: { marginTop: 20, minHeight: 300, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#2F3B46" },
  emptyText: { marginTop: 8, maxWidth: 360, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", justifyContent: "center", padding: 20 },
  reviewCard: { width: "100%", maxWidth: 520, padding: 22, borderRadius: 22, backgroundColor: "#FFFFFF" },
  reviewCardCompact: { padding: 18 },
  reviewTitle: { fontSize: 26, fontWeight: "800", color: "#111111" },
  reviewLine: { marginTop: 12, fontSize: 15, lineHeight: 22, color: "#40504A" },
  reviewCloseButton: { marginTop: 22, minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#06774B" },
  reviewCloseButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
});
