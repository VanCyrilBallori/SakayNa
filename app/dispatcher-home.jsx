import { Feather, FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { db } from "../firebase";
import { useCurrentUserProfile } from "../lib/session";

const requests = [
  {
    id: "medical-001",
    level: "Emergency",
    status: "Assigned",
    title: "Medical",
    vehicle: "Ambulance",
    barangay: "Brgy. Talavera",
    pickupLocation: "Barangay Health Center",
    destination: "Toledo Poblacion Health Center",
    summary: "Medical response request already assigned to a responder.",
    color: "#F6D0D0",
    chip: "#C53A3A",
  },
  {
    id: "asthma-001",
    level: "Urgent",
    status: "Assigned",
    title: "Asthma Attack",
    vehicle: "Ambulance",
    barangay: "Brgy. Talavera",
    pickupLocation: "Talavera Barangay Hall",
    destination: "Toledo City Hospital",
    summary: "Asthma response request already assigned to a responder.",
    color: "#F5EFCE",
    chip: "#989400",
  },
  {
    id: "accident-001",
    level: "Urgent",
    status: "Pending",
    title: "Accident",
    vehicle: "Rescue Vehicle",
    barangay: "Brgy. Talavera",
    pickupLocation: "Talavera Road Crossing",
    destination: "Toledo City Hospital",
    summary: "Accident transport request waiting for an available driver assignment.",
    color: "#F5EFCE",
    chip: "#989400",
  },
  {
    id: "transfer-001",
    level: "Non-Urgent",
    status: "Pending",
    title: "Patient Transfer",
    vehicle: "Barangay Van",
    barangay: "Brgy. Talavera",
    pickupLocation: "Barangay Health Center",
    destination: "Toledo Poblacion Health Center",
    summary: "Patient transfer request waiting for an available driver assignment.",
    color: "#D1E6DD",
    chip: "#06774B",
  },
];

export default function DispatcherHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1100;
  const { authUser, displayName } = useCurrentUserProfile();
  const [selectedRequest, setSelectedRequest] = useState(requests[0]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [mapStatus, setMapStatus] = useState("Ready");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [requestToAssign, setRequestToAssign] = useState(null);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignedRequestIds, setAssignedRequestIds] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);

  const visibleRequests = useMemo(
    () =>
      requests.map((request) => ({
        ...request,
        status: assignedRequestIds.includes(request.id) ? "Assigned" : request.status,
      })),
    [assignedRequestIds]
  );
  const pendingRequests = useMemo(() => visibleRequests.filter((request) => request.status === "Pending"), [visibleRequests]);

  useEffect(() => {
    const driversQuery = query(collection(db, "users"), where("role", "==", "Driver"));
    const unsubscribe = onSnapshot(
      driversQuery,
      (snapshot) => {
        const nextDrivers = snapshot.docs.map((driverDoc) => {
          const data = driverDoc.data();

          return {
            id: driverDoc.id,
            name: data.fullName || data.email || "Driver",
            email: data.email ?? "",
            barangay: data.barangay ?? "No barangay set",
            availability: data.availability ?? "Unavailable",
          };
        });

        setDrivers(nextDrivers);
        setSelectedDriver((current) => {
          if (!current) {
            return nextDrivers[0] ?? null;
          }

          return nextDrivers.find((driver) => driver.id === current.id) ?? nextDrivers[0] ?? null;
        });
      },
      (error) => console.log("Drivers listener warning:", error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const assignmentsQuery = query(collection(db, "driverAssignments"), where("status", "==", "Assigned"));
    const unsubscribe = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        setAssignedRequestIds(snapshot.docs.map((assignmentDoc) => assignmentDoc.data().requestId).filter(Boolean));
      },
      (error) => console.log("Assignments listener warning:", error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const callsQuery = query(collection(db, "callSessions"), where("targetRole", "==", "Dispatcher"), where("status", "==", "ringing"));
    const unsubscribe = onSnapshot(
      callsQuery,
      (snapshot) => {
        const calls = snapshot.docs.map((callDoc) => ({
          id: callDoc.id,
          ...callDoc.data(),
        }));

        setIncomingCall(calls[0] ?? null);
      },
      (error) => console.log("Incoming call listener warning:", error)
    );

    return unsubscribe;
  }, []);

  const driverSummary = useMemo(() => {
    if (!selectedDriver) {
      return "No registered driver selected";
    }

    return `${selectedDriver.name} | ${selectedDriver.availability}`;
  }, [selectedDriver]);

  const openAssignModal = (driver) => {
    setSelectedDriver(driver);
    setRequestToAssign(null);
    setAssignmentMessage("");

    if (driver.availability !== "Available") {
      return;
    }

    setAssignModalOpen(true);
  };

  const handleAssignRequest = async () => {
    if (!selectedDriver || !requestToAssign) {
      return;
    }

    try {
      await addDoc(collection(db, "driverAssignments"), {
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        dispatcherId: authUser?.uid ?? "",
        dispatcherName: displayName,
        requestId: requestToAssign.id,
        request: requestToAssign,
        status: "Assigned",
        createdAt: serverTimestamp(),
      });

      setSelectedRequest({ ...requestToAssign, status: "Assigned" });
      setAssignmentMessage(`${requestToAssign.title} assigned to ${selectedDriver.name}.`);
      setAssignModalOpen(false);
      setRequestToAssign(null);
    } catch (error) {
      console.log("Assign request failed:", error);
      setAssignmentMessage("Assignment failed. Please check Firestore permissions.");
    }
  };

  const answerIncomingCall = async () => {
    if (!incomingCall) {
      return;
    }

    try {
      await updateDoc(doc(db, "callSessions", incomingCall.id), {
        dispatcherId: authUser?.uid ?? "",
        dispatcherName: displayName,
        status: "connected",
        updatedAt: serverTimestamp(),
      });
      setIncomingCall(null);
    } catch (error) {
      console.log("Answer emergency call failed:", error);
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall) {
      return;
    }

    try {
      await updateDoc(doc(db, "callSessions", incomingCall.id), {
        status: "declined",
        updatedAt: serverTimestamp(),
      });
      setIncomingCall(null);
    } catch (error) {
      console.log("Decline emergency call failed:", error);
    }
  };

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppBrandHeader role="Dispatcher" name={displayName} onLogoutPress={() => router.replace("/")} />

        <View style={[styles.container, compact && styles.containerCompact]}>
          <View style={styles.sectionLabels}>
            <View style={styles.sectionLabelLeft}>
              <Text style={styles.sectionLabelText}>Pending Requests</Text>
            </View>
            <View style={styles.sectionLabelMap}>
              <Text style={styles.sectionLabelText}>Live Map</Text>
            </View>
            <View style={styles.sectionLabelRight}>
              <Text style={styles.sectionLabelText}>Drivers</Text>
            </View>
          </View>

          <View style={styles.mainGrid}>
            <View style={styles.leftPanel}>
              <Text style={styles.panelLabel}>Latest queue</Text>
              {visibleRequests.map((request) => (
                <TouchableOpacity
                  key={request.id}
                  style={[
                    styles.requestCard,
                    { backgroundColor: request.color },
                    selectedRequest.id === request.id && styles.requestCardActive,
                  ]}
                  onPress={() => setSelectedRequest(request)}
                >
                  <View style={styles.requestTop}>
                    <View style={[styles.requestChip, { backgroundColor: request.chip }]}>
                      <Text style={styles.requestChipText}>{request.level}</Text>
                    </View>
                    <Text style={styles.requestStatus}>{request.status}</Text>
                  </View>
                  <Text style={styles.requestTitle}>{request.title}</Text>
                  <Text style={styles.requestMeta}>2026/03/19 | {request.vehicle} | {request.barangay}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.mapPanel}>
              <View style={styles.mapToolbar}>
                <View style={styles.mapToolbarCopy}>
                  <Text style={styles.mapToolbarTitle}>{selectedRequest.title} | {selectedRequest.status}</Text>
                  <Text style={styles.mapToolbarSubtext}>{driverSummary}</Text>
                </View>
                <TouchableOpacity
                  style={styles.mapAction}
                  onPress={() => setMapStatus((current) => (current === "Ready" ? "Refreshing" : "Ready"))}
                >
                  <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                  <Text style={styles.mapActionText}>{mapStatus}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mapPlaceholder}>
                <View style={styles.mapCrossWrap}>
                  <Text style={styles.mapCross}>+</Text>
                </View>
                <Text style={styles.mapPlaceholderTitle}>Blank map canvas</Text>
                <Text style={styles.mapPlaceholderText}>
                  Select an available registered driver to assign a pending request into their Patient Transfer inbox.
                </Text>
                {assignmentMessage ? <Text style={styles.assignmentMessage}>{assignmentMessage}</Text> : null}
              </View>
            </View>

            <View style={styles.rightPanel}>
              <Text style={styles.panelLabel}>Driver availability</Text>
              {drivers.length ? (
                drivers.map((driver) => (
                  <TouchableOpacity
                    key={driver.id}
                    style={[
                      styles.driverCard,
                      driver.availability === "Unavailable" && styles.driverCardUnavailable,
                      selectedDriver?.id === driver.id && styles.driverCardActive,
                    ]}
                    onPress={() => openAssignModal(driver)}
                  >
                    <View style={styles.driverTop}>
                      <View style={styles.driverIdentity}>
                        <View style={styles.driverAvatar}>
                          <FontAwesome name="user" size={22} color="#111111" />
                        </View>
                        <View style={styles.driverCopy}>
                          <Text style={styles.driverName}>{driver.name}</Text>
                          <Text style={styles.driverPlace}>{driver.barangay}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusPill, driver.availability === "Available" ? styles.statusPillAvailable : styles.statusPillUnavailable]}>
                        <Text style={styles.statusPillText}>{driver.availability}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyDriversCard}>
                  <Text style={styles.emptyDriversTitle}>No registered drivers</Text>
                  <Text style={styles.emptyDriversText}>Driver accounts will appear here after signup.</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={assignModalOpen} transparent animationType="fade" onRequestClose={() => setAssignModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, compact && styles.modalCardCompact]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Request</Text>
                <Text style={styles.modalSubtitle}>{selectedDriver?.name} is available</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setAssignModalOpen(false)}>
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Latest pending requests</Text>
            <View style={styles.modalRequestList}>
              {pendingRequests.length ? (
                pendingRequests.map((request) => (
                  <TouchableOpacity
                    key={request.id}
                    style={[styles.modalRequestCard, requestToAssign?.id === request.id && styles.modalRequestCardActive]}
                    onPress={() => setRequestToAssign(request)}
                  >
                    <View style={[styles.requestChip, { backgroundColor: request.chip }]}>
                      <Text style={styles.requestChipText}>{request.level}</Text>
                    </View>
                    <View style={styles.modalRequestCopy}>
                      <Text style={styles.modalRequestTitle}>{request.title}</Text>
                      <Text style={styles.modalRequestMeta}>{request.vehicle} | {request.barangay}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmptyState}>
                  <Text style={styles.modalEmptyTitle}>No pending requests</Text>
                  <Text style={styles.modalEmptyText}>New pending requests will appear here for assignment.</Text>
                </View>
              )}
            </View>

            {requestToAssign ? (
              <TouchableOpacity style={styles.assignButton} onPress={handleAssignRequest}>
                <Text style={styles.assignButtonText}>Assign</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(incomingCall)} transparent animationType="fade" onRequestClose={declineIncomingCall}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, compact && styles.modalCardCompact]}>
            <Text style={styles.modalTitle}>Incoming Emergency Call</Text>
            <Text style={styles.modalSubtitle}>{incomingCall?.residentName || "Resident"} is calling the dispatcher station.</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.declineButton]} onPress={declineIncomingCall}>
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.answerButton]} onPress={answerIncomingCall}>
                <Text style={styles.answerButtonText}>Answer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 24 },
  container: { width: "100%", maxWidth: 1320, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 14 },
  sectionLabels: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" },
  sectionLabelLeft: { width: 170, alignItems: "flex-start" },
  sectionLabelMap: { flex: 2.3, minWidth: 420, alignItems: "center" },
  sectionLabelRight: { width: 170, alignItems: "flex-start" },
  sectionLabelText: { fontSize: 24, fontWeight: "800", color: "#06774B" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "stretch" },
  leftPanel: { width: 170, flexGrow: 1, padding: 14, borderRadius: 20, backgroundColor: "#E3E7E5", gap: 10 },
  panelLabel: { fontSize: 16, fontWeight: "700", color: "#496B5F" },
  requestCard: { borderRadius: 18, padding: 16 },
  requestCardActive: { borderWidth: 2, borderColor: "#06774B" },
  requestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  requestChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, alignSelf: "flex-start" },
  requestChipText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  requestStatus: { fontSize: 13, fontWeight: "700", color: "#344640" },
  requestTitle: { marginTop: 10, fontSize: 18, fontWeight: "800", color: "#111111" },
  requestMeta: { marginTop: 10, fontSize: 12, lineHeight: 17, color: "#465752" },
  mapPanel: { flex: 2.3, minWidth: 420, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D6DFDB", overflow: "hidden" },
  mapToolbar: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E5ECE8", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  mapToolbarCopy: { flex: 1, minWidth: 220 },
  mapToolbarTitle: { fontSize: 20, fontWeight: "800", color: "#1F2E29" },
  mapToolbarSubtext: { marginTop: 4, fontSize: 13, lineHeight: 20, color: "#60716B" },
  mapAction: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#06774B" },
  mapActionText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  mapPlaceholder: { minHeight: 680, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 36, backgroundColor: "#F7F9F8" },
  mapCrossWrap: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: "#CDD6D2", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  mapCross: { fontSize: 58, lineHeight: 58, color: "#A4B0AA" },
  mapPlaceholderTitle: { marginTop: 18, fontSize: 26, fontWeight: "800", color: "#2D3934", textAlign: "center" },
  mapPlaceholderText: { marginTop: 12, maxWidth: 520, fontSize: 16, lineHeight: 24, color: "#61716B", textAlign: "center" },
  assignmentMessage: { marginTop: 16, fontSize: 15, fontWeight: "800", color: "#06774B", textAlign: "center" },
  rightPanel: { width: 170, flexGrow: 1, padding: 14, borderRadius: 20, backgroundColor: "#E3E7E5", gap: 10 },
  driverCard: { padding: 14, borderRadius: 18, backgroundColor: "#06774B" },
  driverCardUnavailable: { backgroundColor: "#68756D" },
  driverCardActive: { borderWidth: 2, borderColor: "#DFF5EA" },
  driverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  driverIdentity: { flexDirection: "row", gap: 10, alignItems: "center", flex: 1, minWidth: 180 },
  driverAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  driverCopy: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  driverPlace: { marginTop: 2, fontSize: 12, color: "#DDEEE7" },
  statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  statusPillAvailable: { backgroundColor: "#E5FFF2" },
  statusPillUnavailable: { backgroundColor: "#F0E8E8" },
  statusPillText: { fontSize: 12, fontWeight: "700", color: "#26433A" },
  emptyDriversCard: { padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF" },
  emptyDriversTitle: { fontSize: 16, fontWeight: "800", color: "#24342E" },
  emptyDriversText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#66776F" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 640,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
  },
  modalCardCompact: { borderRadius: 20, padding: 18 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", gap: 14, alignItems: "flex-start" },
  modalTitle: { fontSize: 28, fontWeight: "800", color: "#111111" },
  modalSubtitle: { marginTop: 4, fontSize: 15, color: "#60716B" },
  modalClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F51D1D",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  modalLabel: { marginTop: 18, fontSize: 16, fontWeight: "800", color: "#24342E" },
  modalRequestList: { marginTop: 12, gap: 10 },
  modalRequestCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F0F4F2",
    borderWidth: 1,
    borderColor: "#DCE5E0",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  modalRequestCardActive: { borderColor: "#06774B", backgroundColor: "#E5F4ED" },
  modalRequestCopy: { flex: 1 },
  modalRequestTitle: { fontSize: 17, fontWeight: "800", color: "#111111" },
  modalRequestMeta: { marginTop: 4, fontSize: 13, color: "#60716B" },
  modalEmptyState: { padding: 18, borderRadius: 16, backgroundColor: "#F0F4F2", borderWidth: 1, borderColor: "#DCE5E0" },
  modalEmptyTitle: { fontSize: 17, fontWeight: "800", color: "#24342E" },
  modalEmptyText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#66776F" },
  assignButton: {
    marginTop: 18,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#06774B",
    alignItems: "center",
    justifyContent: "center",
  },
  assignButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 22 },
  modalButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: { backgroundColor: "#D9D9D9" },
  answerButton: { backgroundColor: "#06774B" },
  declineButtonText: { fontSize: 16, fontWeight: "800", color: "#111111" },
  answerButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
});
