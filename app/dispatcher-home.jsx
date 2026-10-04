import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { assignDispatcherRequest } from "../features/dispatcher/services/dispatcherAssignmentService";
import { formatRequestDate, getAssistanceText, getPassengerCountText, getPassengerName, getScheduledDate, getWhenText } from "../features/resident/utils/requestMapper";
import { startPhoneCall } from "../lib/phoneCall";
import LeafletMap from "../components/LeafletMap";
import { DESIGN_COLORS } from "../constants/design";
import { db } from "../firebase";
import { getTimestampMillis } from "../lib/dates";
import {
  DRIVER_SCHEDULE_COLLECTION,
  getDateFromValue,
} from "../lib/driverScheduling";
import { formatDutyDuration, formatManilaTime } from "../lib/dutyTime";
import { getAuthErrorMessage, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";

// A ringing alert whose "I'm still here" signal (lastActiveAt) hasn't changed for this long is
// treated as stuck (the resident's app crashed or closed) and hidden. It is only hidden, not
// changed in Firestore, so it comes back by itself if the signal starts again.
const STUCK_ALERT_MS = 120_000;
const STUCK_CHECK_INTERVAL_MS = 10_000;

// Why a driver can't be given a ride right now, or "" if they can (driver-duty-plan.md Step 5).
const getAssignBlockReason = (driver) => {
  if (driver.accountStatus !== "Approved") return "Not approved yet.";
  if (driver.activeAssignment?.status === "Assigned") return "Has a ride waiting to be accepted.";
  if (driver.activeAssignment) return "Handling a ride.";
  if (driver.dutyStatus === "On break") return driver.breakType ? `On a break (${driver.breakType}).` : "On a break.";
  if (driver.dutyStatus === "On a run") return "On a run.";
  if (driver.dutyStatus !== "Available") return "Off duty: not punched in.";
  return "";
};

// The badge on each driver card: always a word with its color (DESIGN.md).
const DUTY_BADGES = {
  Available: { label: "Available", backgroundColor: DESIGN_COLORS.hallGreen, color: DESIGN_COLORS.paperWhite },
  "On break": { label: "On break", backgroundColor: DESIGN_COLORS.sakayOrange, color: DESIGN_COLORS.ink },
  "On a run": { label: "On a run", backgroundColor: DESIGN_COLORS.hallGreenDeep, color: DESIGN_COLORS.paperWhite },
  "Off duty": { label: "Off duty", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite },
};

const getRequestStyle = (level) => {
  if (level === "Emergency") {
    return { color: "#F6D0D0", chip: "#C53A3A" };
  }

  if (level === "Urgent") {
    return { color: "#F5EFCE", chip: "#989400" };
  }

  return { color: "#D1E6DD", chip: "#06774B" };
};

// "+639171234567" → "0917 123 4567", so it is easy to read and dial from an office phone.
const formatPhoneForDialing = (phone = "") => {
  const match = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(phone);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : phone;
};

// Opens the resident's GPS position in Google Maps (the app on a phone, a new tab on the website).
const openLocationInMaps = async (location) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.log("Open location warning:", error);
    Alert.alert("Map not opened", "The map could not be opened on this device.");
  }
};

// Who sent an emergency alert and how to reach them: big tap-to-call phone, barangay or place, and the map link.
// call = the alert (callSessions document). It updates by itself when the resident's location arrives a few seconds later.
function EmergencyCallerDetails({ call }) {
  const phone = call?.residentPhone || "";
  const location = call?.location;
  const hasLocation = typeof location?.latitude === "number" && typeof location?.longitude === "number";
  // pickupLocation starts as the resident's barangay and becomes the GPS address once the location arrives.
  const place = call?.pickupLocation || "Not provided";

  return (
    <View style={styles.callerDetails}>
      {phone ? (
        <Pressable
          style={({ pressed }) => [styles.callerPhoneButton, pressed && styles.callerPhoneButtonPressed]}
          onPress={() => startPhoneCall(phone)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${formatPhoneForDialing(phone)}`}
        >
          <MaterialCommunityIcons name="phone" size={28} color="#FFFFFF" />
          <Text style={styles.callerPhoneText}>{formatPhoneForDialing(phone)}</Text>
        </Pressable>
      ) : (
        <Text style={styles.callerLine}>No phone number on file.</Text>
      )}

      <Text style={styles.callerLine}>
        <Text style={styles.callerLabel}>Barangay / place: </Text>
        {place}
      </Text>

      {hasLocation ? (
        <Pressable
          style={({ pressed }) => [styles.callerMapButton, pressed && styles.callerMapButtonPressed]}
          onPress={() => openLocationInMaps(location)}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="map-marker-outline" size={24} color={DESIGN_COLORS.hallGreen} />
          <Text style={styles.callerMapText}>Open location in Maps</Text>
        </Pressable>
      ) : (
        <Text style={styles.callerLine}>Location not sent (yet). Use the barangay above.</Text>
      )}
    </View>
  );
}

// Rides scheduled more than this far ahead get the "Assign it closer to the time" warning.
const ASSIGN_EARLY_WARNING_MS = 2 * 60 * 60_000;

// True for a scheduled ride that is still more than 2 hours away. now = Date.now() from the screen's clock.
const isScheduledFarAhead = (request, now) => {
  const scheduled = getScheduledDate(request);
  return Boolean(scheduled) && scheduled.getTime() - now > ASSIGN_EARLY_WARNING_MS;
};

// "ASAP", "Scheduled: Fri, Oct 2, 9:00 AM", or in red "Scheduled time passed: ..." when nobody assigned it in time.
function WhenLabel({ request, now, style }) {
  const scheduled = getScheduledDate(request);
  if (!scheduled) return <Text style={style}>ASAP</Text>;
  const passed = scheduled.getTime() < now;
  return <Text style={[style, passed && styles.whenPassed]}>{passed ? "Scheduled time passed" : "Scheduled"}: {getWhenText(request)}</Text>;
}

// Why a driver gave this ride back (driver-pages-plan.md Step 2b), e.g. "Vehicle problem", or "" if no driver did.
// "I can't do this ride" saves lastUnableReason; a Decline from an older APK saves lastDeclineReason.
// Only Pending rides are on this screen, so a ride that was assigned again never shows it.
const getGivenBackReason = (request) => request.lastUnableReason || request.lastDeclineReason || "";

// Waiting list order: rides a driver gave back first (someone was already waiting for them),
// then ASAP rides (the one waiting longest on top), then scheduled rides (soonest first).
// A request the server hasn't timed yet goes last in its group.
const queueOrder = (request) => {
  if (getGivenBackReason(request)) return [-1, request.createdAt?.toMillis?.() ?? Infinity];
  const scheduled = getScheduledDate(request);
  return scheduled ? [1, scheduled.getTime()] : [0, request.createdAt?.toMillis?.() ?? Infinity];
};

// Everything about the request the dispatcher tapped, under the queue / map / drivers columns.
// One driver in the "Driver availability" list (driver-duty-plan.md Step 5, DESIGN.md look):
// name, duty status badge, how long they have been in it, and why they can't be assigned (greyed out).
// "now" is the screen's 10-second clock, so the time moves every 10 seconds.
function DriverDutyRow({ driver, now, selected, onPress }) {
  const badge = DUTY_BADGES[driver.dutyStatus] || DUTY_BADGES["Off duty"];
  const badgeLabel = driver.dutyStatus === "On break" && driver.breakType ? `On break · ${driver.breakType}` : badge.label;
  const sinceMs = driver.dutyStatusSinceMs;
  const canAssign = !driver.blockReason;
  // Punched in, but the driver's app is closed: our simple, no-server stand-in for "Unreachable".
  const appClosed = canAssign && driver.presence === "Offline";
  // The driver sent "I can't do this ride" and has not changed their duty status since (driver-pages-plan.md Step 2b).
  const report = driver.unableReport;
  const reportAgo = report ? (now - report.atMs < 60_000 ? "just now" : `${formatDutyDuration(now - report.atMs)} ago`) : "";
  const reportText = report ? `Reported: can't do a ride (${report.reason}), ${reportAgo}` : "";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.driverCard,
        !canAssign && styles.driverCardBlocked,
        canAssign && selected && styles.driverCardSelected,
        canAssign && pressed && styles.driverCardPressed,
      ]}
      onPress={onPress}
      disabled={!canAssign}
      accessibilityRole="button"
      accessibilityState={{ disabled: !canAssign, selected }}
      accessibilityLabel={`${driver.name}, ${badgeLabel}. ${reportText ? `${reportText}. ` : ""}${canAssign ? "Tap to assign a ride." : `Can't assign: ${driver.blockReason}`}`}
    >
      <Text style={[styles.driverName, !canAssign && styles.driverNameBlocked]}>{driver.name}</Text>
      <Text style={styles.driverPlace}>{driver.barangay}</Text>

      <View style={styles.dutyLine}>
        <View style={[styles.dutyBadge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.dutyBadgeText, { color: badge.color }]}>{badgeLabel}</Text>
        </View>
        {sinceMs !== null ? (
          <Text style={styles.dutySince}>
            since {formatManilaTime(sinceMs)} · {formatDutyDuration(now - sinceMs)}
          </Text>
        ) : null}
      </View>

      {driver.dutyStatus === "On break" && driver.breakNote ? <Text style={styles.driverMetaLine}>Note: {driver.breakNote}</Text> : null}
      {driver.activeAssignment ? <Text style={styles.driverMetaLine}>Ride: {driver.activeAssignment.title || "Assigned ride"}</Text> : null}
      <Text style={styles.driverMetaLine}>Vehicle: {driver.linkedVehicle?.name || "No linked vehicle"}</Text>

      {appClosed ? (
        <View style={styles.appClosedBox}>
          <MaterialCommunityIcons name="cellphone-off" size={22} color={DESIGN_COLORS.orangeDeep} />
          <Text style={styles.appClosedText}>
            Available · app closed. Call {driver.phoneNumber ? formatPhoneForDialing(driver.phoneNumber) : "the driver"} first.
          </Text>
        </View>
      ) : null}
      {/* Same peach box as "app closed": the dispatcher should know before giving this driver another ride. */}
      {report ? (
        <View style={styles.appClosedBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={DESIGN_COLORS.orangeDeep} />
          <Text style={styles.appClosedText}>{reportText}</Text>
        </View>
      ) : null}
      {!canAssign ? <Text style={styles.blockReasonText}>Can&apos;t assign: {driver.blockReason}</Text> : null}
    </Pressable>
  );
}

function SelectedRequestDetails({ request, now }) {
  if (!request) {
    return (
      <View style={styles.detailsPanel}>
        <Text style={styles.detailsHeading}>Selected Request</Text>
        <Text style={styles.detailsEmpty}>Tap a request in the list to see its details.</Text>
      </View>
    );
  }

  const phone = request.contactNumber || request.residentPhone || "";
  const bookedForSomeoneElse = request.ridingFor === "other";
  const items = [
    ["People riding", getPassengerCountText(request)],
    ["Pickup", [request.pickupLocation, request.barangay].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(", ")],
    ["Landmark / pickup details", request.pickupDetails || "Not provided"],
    ["Going to", request.destination || "Not provided"],
    ["Needs help", getAssistanceText(request)],
    ["Notes", request.additionalNotes || "None"],
  ];

  return (
    <View style={styles.detailsPanel}>
      <Text style={styles.detailsHeading}>Selected Request</Text>

      <View style={styles.detailsTop}>
        <View style={[styles.requestChip, { backgroundColor: request.chip }]}>
          <Text style={styles.requestChipText}>{request.level}</Text>
        </View>
        <Text style={styles.detailsTitle}>{request.title}</Text>
        <Text style={styles.detailsMuted}>
          <WhenLabel request={request} now={now} /> · {request.reference || request.id} · Sent {formatRequestDate(request.createdAt)}
        </Text>
      </View>

      {/* A driver gave this ride back: say who and why (driver-pages-plan.md Step 2b). Peach = important info. */}
      {getGivenBackReason(request) ? (
        <View style={styles.givenBackBox}>
          <Text style={styles.givenBackBoxText}>
            <Text style={styles.givenBackBoxStrong}>Driver can&apos;t do this ride: </Text>
            {getGivenBackReason(request)}
            {request.lastUnableDriverName ? ` (${request.lastUnableDriverName})` : ""}
          </Text>
        </View>
      ) : null}

      <View style={styles.detailsPhoneBlock}>
        <Text style={styles.detailsLabel}>Passenger</Text>
        <Text style={styles.detailsPassenger}>{getPassengerName(request)}</Text>
        {phone ? (
          <TouchableOpacity onPress={() => startPhoneCall(phone)} accessibilityRole="button" accessibilityLabel={`Call ${formatPhoneForDialing(phone)}`}>
            <Text style={styles.detailsPhone} selectable>
              {formatPhoneForDialing(phone)}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.detailsValue}>No phone number</Text>
        )}
        {bookedForSomeoneElse ? (
          <Text style={styles.detailsMuted}>
            Booked by {request.residentName || "a resident"}
            {request.residentPhone && request.residentPhone !== phone ? ` · ${formatPhoneForDialing(request.residentPhone)}` : " (this is the resident's number)"}
          </Text>
        ) : null}
      </View>

      <View style={styles.detailsGrid}>
        {items.map(([label, value]) => (
          <View key={label} style={styles.detailsItem}>
            <Text style={styles.detailsLabel}>{label}</Text>
            <Text style={styles.detailsValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DispatcherHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1100;
  const mapSquareSize = useMemo(() => {
    if (compact) {
      return Math.max(320, Math.min(width - 32, 640));
    }

    return Math.max(520, Math.min(width - 640, 760));
  }, [compact, width]);
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [requestToAssign, setRequestToAssign] = useState(null);
  const [, setAssignmentMessage] = useState("");
  // Why "Assign" failed, shown inside the assign window.
  const [assignError, setAssignError] = useState("");
  const [assignedRequestIds, setAssignedRequestIds] = useState([]);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [ringingCalls, setRingingCalls] = useState([]);
  // Alerts this dispatcher answered that are still going ("Active emergency" cards).
  const [activeCalls, setActiveCalls] = useState([]);
  // The alert whose "End this emergency?" question is open (null = closed), and its error message.
  const [endingCall, setEndingCall] = useState(null);
  const [endError, setEndError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  // For each ringing alert: its last lastActiveAt value, and when THIS device saw it change.
  // Using only this device's own clock means a wrong clock on any phone or PC can't hide a live alert.
  const lastSignOfLifeRef = useRef({});
  const [vehicles, setVehicles] = useState([]);
  // Every "I can't do this ride" report (driverAssignments with status "Unable"), for the warning on the driver cards.
  const [unableReports, setUnableReports] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [driverSchedules, setDriverSchedules] = useState([]);

  const visibleRequests = useMemo(() => requests.filter((request) => !assignedRequestIds.includes(request.id)), [assignedRequestIds, requests]);
  const pendingRequests = useMemo(() => visibleRequests.filter((request) => request.status === "Pending"), [visibleRequests]);
  // Rides a driver gave back, for the orange "Needs a new driver" banners at the top (driver-pages-plan.md Step 2b).
  // A banner goes away by itself when its ride is assigned again (it is no longer Pending).
  const givenBackRequests = useMemo(() => pendingRequests.filter((request) => getGivenBackReason(request)), [pendingRequests]);
  const driversWithAssignments = useMemo(
    () =>
      drivers.map((driver) => {
        const activeAssignment = activeAssignments.find((assignment) => assignment.driverId === driver.id);

        return {
          ...driver,
          activeAssignment,
          dispatchStatus: activeAssignment?.status ?? driver.availability,
        };
      }),
    [activeAssignments, drivers]
  );
  const occupiedVehicleIds = useMemo(
    () =>
      activeAssignments
        .filter((assignment) => ["Assigned", "In Progress"].includes(assignment.status))
        .map((assignment) => assignment.vehicleId)
        .filter(Boolean),
    [activeAssignments]
  );
  const selectedDriverUsesOwnVehicle = useMemo(
    () =>
      selectedDriver?.useOwnVehicle === true ||
      vehicles.some((vehicle) => (vehicle.ownerType || "City/Barangay Vehicle") === "Driver-Owned Vehicle" && vehicle.ownerUid === selectedDriver?.id),
    [selectedDriver?.id, selectedDriver?.useOwnVehicle, vehicles]
  );
  const selectedDriverActiveSchedule = useMemo(
    () => driverSchedules.find((schedule) =>
      schedule.driverUid === selectedDriver?.id &&
      ["Available", "Claimed", "On Duty"].includes(schedule.status) &&
      (getDateFromValue(schedule.startAt)?.getTime() ?? 0) <= Date.now() &&
      (getDateFromValue(schedule.endAt)?.getTime() ?? 0) >= Date.now()
    ) ?? null,
    [driverSchedules, selectedDriver?.id]
  );
  const assignableVehicles = useMemo(() => {
    if (!selectedDriver?.id) {
      return [];
    }

    return vehicles.filter((vehicle) => {
      const ownerType = vehicle.ownerType || "City/Barangay Vehicle";
      const isDriverOwned = ownerType === "Driver-Owned Vehicle";
      const matchesDriver = isDriverOwned ? vehicle.ownerUid === selectedDriver.id : !selectedDriverUsesOwnVehicle;
      const isOccupied = occupiedVehicleIds.includes(vehicle.id);
      const currentStatus = vehicle.status || "Available";

      if (!matchesDriver || isOccupied) {
        return false;
      }

      if (selectedDriverUsesOwnVehicle !== isDriverOwned) {
        return false;
      }

      if (isDriverOwned) {
        return ["Available", "Assigned", "In Use"].includes(currentStatus) || Boolean(selectedDriverActiveSchedule);
      }

      return ["Available", "Assigned"].includes(currentStatus);
    });
  }, [occupiedVehicleIds, selectedDriver?.id, selectedDriverActiveSchedule, selectedDriverUsesOwnVehicle, vehicles]);
  const selectedVehicle = useMemo(
    () => assignableVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [assignableVehicles, selectedVehicleId]
  );
  const resolvedVehicle = useMemo(() => {
    if (!requestToAssign) {
      return null;
    }

    if (selectedVehicle) {
      return selectedVehicle;
    }

    return assignableVehicles[0] ?? null;
  }, [assignableVehicles, requestToAssign, selectedVehicle]);
  // One row per driver for the "Driver availability" list (driver-duty-plan.md Step 5).
  // Only an Approved, Available driver with no ride in hand can be assigned; everyone else shows the reason.
  const dispatcherAvailabilityRows = useMemo(
    () =>
      driversWithAssignments.map((driver) => {
        const linkedVehicle = vehicles.find(
          (vehicle) =>
            vehicle.ownerUid === driver.id ||
            vehicle.assignedDriverId === driver.id
        );

        // The driver's newest "I can't do this ride" report, but only if it came after their last duty change.
        // Taking a break, punching out, or accepting a ride hides it again. (">=": a report sent during a run
        // and the change back to "Available" are saved at the same moment.)
        const latestReport = unableReports
          .filter((report) => report.driverId === driver.id && report.atMs !== null)
          .sort((first, second) => second.atMs - first.atMs)[0];
        const unableReport = latestReport && latestReport.atMs >= (driver.dutyStatusSinceMs ?? 0) ? latestReport : null;

        return {
          ...driver,
          linkedVehicle,
          blockReason: getAssignBlockReason(driver),
          unableReport,
        };
      }),
    [driversWithAssignments, unableReports, vehicles]
  );

  useEffect(() => {
    const requestsQuery = query(collection(db, "transportRequests"), where("status", "==", "Pending"));
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const nextRequests = snapshot.docs.map((requestDoc) => {
          const data = requestDoc.data();
          const requestStyle = getRequestStyle(data.level);

          return {
            // Every saved field (passenger, phone, landmark, help needed, notes...) for the
            // Selected request box and the map. The lines below add fallbacks for older requests.
            ...data,
            id: requestDoc.id,
            level: data.priorityLevel ?? data.level ?? "Emergency",
            status: data.status ?? "Pending",
            title: data.title ?? data.emergencyType ?? "Transport Request",
            emergencyType: data.emergencyType ?? data.title ?? "Transport Request",
            vehicle: data.vehicle ?? "Available Vehicle",
            barangay: data.barangay ?? data.pickupLocation ?? "Pickup location pending",
            pickupLocation: data.pickupLocation ?? data.barangay ?? "Pickup location pending",
            destination: data.destination ?? "Nearest available response center",
            summary: data.summary ?? "Resident transport request waiting for dispatcher assignment.",
            residentId: data.residentId ?? "",
            residentName: data.residentName ?? "Resident",
            color: requestStyle.color,
            chip: requestStyle.chip,
          };
        });

        nextRequests.sort((first, second) => {
          const [firstGroup, firstTime] = queueOrder(first);
          const [secondGroup, secondTime] = queueOrder(second);
          return firstGroup - secondGroup || firstTime - secondTime || 0;
        });

        setRequests(nextRequests);
        setSelectedRequest((current) => {
          if (current && nextRequests.some((request) => request.id === current.id)) {
            return current;
          }

          return nextRequests[0] ?? null;
        });
      },
      (error) => console.log("Transport requests listener warning:", error)
    );

    return unsubscribe;
  }, []);

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
            publicDisplayName: data.publicDisplayName ?? "",
            publicPhone: data.publicPhone ?? "",
            operationalPhone: data.operationalPhone ?? "",
            // The driver's own phone. Copied onto the ride when assigned, so the resident can call the driver.
            phoneNumber: data.phoneNumber || data.phone || "",
            barangay: data.barangay ?? "No barangay set",
            availability: data.availability ?? "Unavailable",
            // "Is the driver's app open?" Used for the "App closed" warning.
            presence: data.presence ?? "Offline",
            // Duty status (driver-duty-plan.md). Never punched in = "Off duty".
            dutyStatus: data.dutyStatus ?? "Off duty",
            dutyStatusSinceMs: getTimestampMillis(data.dutyStatusSince),
            breakType: data.breakType ?? "",
            breakNote: data.breakNote ?? "",
            accountStatus: data.accountStatus ?? "Pending",
            useOwnVehicle: data.useOwnVehicle === true,
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
    const assignmentsQuery = query(collection(db, "driverAssignments"), where("status", "in", ["Assigned", "In Progress"]));
    const unsubscribe = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        const assignments = snapshot.docs.map((assignmentDoc) => ({
          id: assignmentDoc.id,
          ...assignmentDoc.data(),
        }));
        const nextActiveAssignments = assignments.filter((assignment) => ["Assigned", "In Progress"].includes(assignment.status));
        const latestDriverUpdate = assignments.find((assignment) => ["In Progress", "Completed", "Declined"].includes(assignment.status));

        setActiveAssignments(nextActiveAssignments);
        setAssignedRequestIds(assignments.filter((assignment) => ["Assigned", "In Progress", "Completed"].includes(assignment.status)).map((assignment) => assignment.requestId).filter(Boolean));

        if (latestDriverUpdate) {
          setAssignmentMessage(`${latestDriverUpdate.driverName || "Driver"} marked ${latestDriverUpdate.request?.title || "mission"} as ${latestDriverUpdate.status}.`);
        }
      },
      (error) => console.log("Assignments listener warning:", error)
    );

    return unsubscribe;
  }, []);

  // "I can't do this ride" reports (driver-pages-plan.md Step 2b). Live, so the warning shows on the driver's card right away.
  useEffect(() => {
    const reportsQuery = query(collection(db, "driverAssignments"), where("status", "==", "Unable"));
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        setUnableReports(
          snapshot.docs.map((reportDoc) => {
            const data = reportDoc.data();
            return { driverId: data.driverId, reason: data.unableReason || "No reason", atMs: getTimestampMillis(data.unableAt) };
          })
        );
      },
      (error) => console.log("Unable reports listener warning:", error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        setVehicles(
          snapshot.docs.map((vehicleDoc) => ({
            id: vehicleDoc.id,
            ...vehicleDoc.data(),
          }))
        );
      },
      (error) => console.log("Vehicles listener warning:", error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, DRIVER_SCHEDULE_COLLECTION),
      (snapshot) => {
        setDriverSchedules(snapshot.docs.map((scheduleDoc) => ({ id: scheduleDoc.id, ...scheduleDoc.data() })));
      },
      (error) => console.log("Driver schedules listener warning:", error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const callsQuery = query(collection(db, "callSessions"), where("targetRole", "==", "Dispatcher"), where("status", "==", "ringing"));
    const unsubscribe = onSnapshot(
      callsQuery,
      (snapshot) => {
        // An alert stays "ringing" for everyone; a decline only hides it from the dispatcher who declined.
        const calls = snapshot.docs
          .map((callDoc) => ({
            id: callDoc.id,
            ...callDoc.data(),
          }))
          .filter((call) => !(call.declinedBy ?? []).includes(authUser?.uid));

        const previous = lastSignOfLifeRef.current;
        const next = {};
        calls.forEach((call) => {
          const signOfLife = getTimestampMillis(call.lastActiveAt);
          const seenBefore = previous[call.id];
          next[call.id] = seenBefore && seenBefore.signOfLife === signOfLife ? seenBefore : { signOfLife, seenAt: Date.now() };
        });
        lastSignOfLifeRef.current = next;

        setRingingCalls(calls);
      },
      (error) => console.log("Incoming call listener warning:", error)
    );

    return unsubscribe;
  }, [authUser?.uid]);

  // Answered alerts stay on screen until they end: the resident taps Done, or this dispatcher taps "End emergency".
  // That way the phone number and location are still at hand after the "Incoming Emergency Call" pop-up closes.
  useEffect(() => {
    if (!authUser?.uid) return undefined;

    const activeQuery = query(collection(db, "callSessions"), where("dispatcherId", "==", authUser.uid), where("status", "==", "connected"));
    const unsubscribe = onSnapshot(
      activeQuery,
      (snapshot) => setActiveCalls(snapshot.docs.map((callDoc) => ({ id: callDoc.id, ...callDoc.data() }))),
      (error) => console.log("Active emergency listener warning:", error)
    );

    return unsubscribe;
  }, [authUser?.uid]);

  // A crashed app sends no more updates, so nothing would trigger a re-check. This clock does.
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), STUCK_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const liveCall = ringingCalls.find((call) => {
      const seenAt = lastSignOfLifeRef.current[call.id]?.seenAt ?? Date.now();
      return now - seenAt < STUCK_ALERT_MS;
    });

    setIncomingCall(liveCall ?? null);
  }, [ringingCalls, now]);

  const openAssignModal = (driver) => {
    setSelectedDriver(driver);
    setRequestToAssign(null);
    setSelectedVehicleId("");
    setAssignmentMessage("");

    setAssignError("");

    // Only Available drivers can be picked. The card already shows the reason for the others.
    if (driver.blockReason) {
      return;
    }

    setAssignModalOpen(true);
  };

  const handleAssignRequest = async () => {
    if (!selectedDriver || !requestToAssign || !resolvedVehicle || !authUser?.uid) {
      setAssignmentMessage("Choose a valid request, driver, and vehicle before assigning.");
      return;
    }

    try {
      await assignDispatcherRequest({
        requestId: requestToAssign.id,
        driver: selectedDriver,
        vehicle: resolvedVehicle,
        dispatcher: { uid: authUser.uid, name: displayName, officePhone: profile?.officePhone || profile?.operationalPhone || "" },
        priority: requestToAssign.dispatcherConfirmedPriority || requestToAssign.level || "",
      });
      setSelectedRequest({ ...requestToAssign, status: "Assigned", vehicle: resolvedVehicle.name });
      setAssignmentMessage(`${requestToAssign.title} assigned to ${selectedDriver.name} with ${resolvedVehicle.name}.`);
      setAssignModalOpen(false);
      setRequestToAssign(null);
      setSelectedVehicleId("");
    } catch (error) {
      console.log("Assign request failed:", error);
      setAssignmentMessage(error?.message || "Assignment could not be completed. Refresh the request and try again.");
      // Shown inside the assign window (for example: the driver started a break at the same moment).
      setAssignError(error?.message || "Assignment could not be completed. Refresh the request and try again.");
    }
  };
  const handleCancelAssignModal = () => {
    setAssignError("");
    setAssignModalOpen(false);
    setRequestToAssign(null);
    setSelectedVehicleId("");
    setAssignmentMessage("");
  };

  const answerIncomingCall = async () => {
    if (!incomingCall) {
      return;
    }

    try {
      await updateDoc(doc(db, "callSessions", incomingCall.id), {
        dispatcherId: authUser?.uid ?? "",
        dispatcherName: displayName,
        dispatcherPhone: profile?.officePhone || profile?.operationalPhone || "",
        status: "connected",
        updatedAt: serverTimestamp(),
      });
      setIncomingCall(null);
    } catch (error) {
      console.log("Answer emergency call failed:", error);
    }
  };

  // "End emergency": marks the alert "ended", so its card closes.
  // If the resident's alert screen is still open, it shows "Alert closed".
  const endEmergency = async () => {
    if (!endingCall) return;

    try {
      await updateDoc(doc(db, "callSessions", endingCall.id), {
        status: "ended",
        updatedAt: serverTimestamp(),
      });
      setEndingCall(null);
    } catch (error) {
      console.log("End emergency failed:", error);
      setEndError("The emergency could not be ended. Check the internet connection and try again.");
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall) {
      return;
    }

    try {
      await updateDoc(doc(db, "callSessions", incomingCall.id), {
        declinedBy: arrayUnion(authUser?.uid ?? ""),
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
        <AppBrandHeader role="Dispatcher" name={displayName} onLogoutPress={async () => {
          try {
            await logoutCurrentUser();
            router.replace("/login");
          } catch (error) {
            Alert.alert("Logout failed", getAuthErrorMessage(error, "We could not log you out. Please try again."));
          }
        }} />

        <View style={[styles.container, compact && styles.containerCompact]}>
          {/* One card per answered emergency that is still going, above everything else. */}
          {activeCalls.map((call) => (
            <View key={call.id} style={styles.activeCard}>
              <Text style={styles.activeTitle} accessibilityRole="header">
                Active emergency · {call.residentName || "Resident"}
              </Text>
              <EmergencyCallerDetails call={call} />
              <Pressable
                style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}
                onPress={() => {
                  setEndError("");
                  setEndingCall(call);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.outlineButtonText}>End emergency</Text>
              </Pressable>
            </View>
          ))}

          {/* "Needs a new driver": one orange banner per ride a driver gave back (driver-pages-plan.md Step 2b).
              Orange with dark words: important, but not an emergency. Tapping it shows the ride in Selected Request. */}
          {givenBackRequests.map((request) => {
            const driverName = request.lastUnableDriverName || "A driver";
            const vehicleName = request.lastUnableVehicleName ? ` · ${request.lastUnableVehicleName}` : "";
            return (
              <Pressable
                key={request.id}
                style={({ pressed }) => [styles.givenBackBanner, pressed && styles.givenBackBannerPressed]}
                onPress={() => setSelectedRequest(request)}
                accessibilityRole="button"
                accessibilityHint="Shows this ride in Selected Request"
              >
                <MaterialCommunityIcons name="alert-outline" size={28} color={DESIGN_COLORS.ink} />
                <View style={styles.givenBackBannerCopy}>
                  <Text style={styles.givenBackBannerTitle} accessibilityRole="header">
                    Needs a new driver: {request.title}
                  </Text>
                  <Text style={styles.givenBackBannerText}>
                    {driverName} can&apos;t do this ride ({getGivenBackReason(request)}
                    {vehicleName}). Choose another driver.
                  </Text>
                </View>
              </Pressable>
            );
          })}

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
            <View style={[styles.leftPanel, compact && styles.sidePanelCompact, { height: mapSquareSize }]}>
              <Text style={styles.panelLabel}>Latest queue</Text>
              <ScrollView style={styles.panelScrollArea} contentContainerStyle={styles.panelScrollContent} showsVerticalScrollIndicator={false}>
                {visibleRequests.length ? (
                  visibleRequests.map((request) => (
                      <TouchableOpacity
                      key={request.id}
                      style={[
                        styles.requestCard,
                        { backgroundColor: request.color },
                        selectedRequest?.id === request.id && styles.requestCardActive,
                      ]}
                      onPress={() => setSelectedRequest(request)}
                    >
                      <View style={styles.requestTop}>
                        <View style={[styles.requestChip, { backgroundColor: request.chip }]}>
                          <Text style={styles.requestChipText}>{request.level}</Text>
                        </View>
                        <WhenLabel request={request} now={now} style={styles.requestStatus} />
                      </View>
                      <Text style={styles.requestTitle}>{request.title}</Text>
                      {getGivenBackReason(request) ? (
                        <View style={styles.givenBackTag}>
                          <Text style={styles.givenBackTagText}>Driver can&apos;t do this ride: {getGivenBackReason(request)}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.requestMeta}>{getPassengerCountText(request)} · {request.barangay}</Text>
                      {getAssistanceText(request) !== "None" ? (
                        <Text style={[styles.requestMeta, styles.requestHelp]}>Needs help: {getAssistanceText(request)}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyRequestsCard}>
                    <Text style={styles.emptyRequestsTitle}>Inbox empty</Text>
                    <Text style={styles.emptyRequestsText}>Resident transport requests will appear here when submitted.</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            <View
              style={[
                styles.mapPanel,
                compact && styles.mapPanelCompact,
                {
                  width: mapSquareSize,
                  height: mapSquareSize,
                  flexBasis: mapSquareSize,
                  maxWidth: mapSquareSize,
                },
              ]}
            >
              <View style={styles.mapPlaceholder}>
                <LeafletMap title={selectedRequest ? `Request ${selectedRequest.reference || selectedRequest.id}` : "Dispatcher Toledo City Map"} markerLabel={selectedRequest?.pickupLocation || "Toledo City, Cebu"} pickupLabel={selectedRequest?.pickupDetails ? `${selectedRequest.pickupLocation} - ${selectedRequest.pickupDetails}` : selectedRequest?.pickupLocation || ""} destinationLabel={selectedRequest?.destination || ""} pickupCoordinates={typeof selectedRequest?.pickup?.latitude === "number" && typeof selectedRequest?.pickup?.longitude === "number" ? [selectedRequest.pickup.latitude, selectedRequest.pickup.longitude] : null} destinationCoordinates={typeof selectedRequest?.destinationLocation?.latitude === "number" && typeof selectedRequest?.destinationLocation?.longitude === "number" ? [selectedRequest.destinationLocation.latitude, selectedRequest.destinationLocation.longitude] : null} />
              </View>
            </View>

            <View style={[styles.rightPanel, compact && styles.sidePanelCompact, { height: mapSquareSize }]}>
              <Text style={styles.panelLabel}>Driver availability</Text>
              <ScrollView style={styles.panelScrollArea} contentContainerStyle={styles.panelScrollContent} showsVerticalScrollIndicator={false}>
                {dispatcherAvailabilityRows.length ? (
                  dispatcherAvailabilityRows.map((driver) => (
                    <DriverDutyRow key={driver.id} driver={driver} now={now} selected={selectedDriver?.id === driver.id} onPress={() => openAssignModal(driver)} />
                  ))
                ) : (
                  <View style={styles.emptyDriversCard}>
                    <Text style={styles.emptyDriversTitle}>No registered drivers</Text>
                    <Text style={styles.emptyDriversText}>Driver accounts will appear here after signup.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>

          <SelectedRequestDetails request={selectedRequest} now={now} />
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
              <TouchableOpacity style={styles.modalClose} onPress={handleCancelAssignModal}>
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
                      <Text style={styles.modalRequestMeta}>{getPassengerCountText(request)} · {request.barangay}</Text>
                      <WhenLabel request={request} now={now} style={styles.modalRequestMeta} />
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

            <Text style={styles.modalLabel}>Available vehicles</Text>
            <View style={styles.modalRequestList}>
              {assignableVehicles.length ? (
                assignableVehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[styles.modalRequestCard, selectedVehicleId === vehicle.id && styles.modalRequestCardActive]}
                    onPress={() => setSelectedVehicleId(vehicle.id)}
                  >
                    <View style={[styles.requestChip, { backgroundColor: "#06774B" }]}>
                      <Text style={styles.requestChipText}>{vehicle.ownerType === "Driver-Owned Vehicle" ? "Driver" : "City"}</Text>
                    </View>
                    <View style={styles.modalRequestCopy}>
                      <Text style={styles.modalRequestTitle}>{vehicle.name || "Registered Vehicle"}</Text>
                      <Text style={styles.modalRequestMeta}>
                        {vehicle.type || "Vehicle"} | {vehicle.plateNumber || "No plate"} | {vehicle.status || "Available"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmptyState}>
                  <Text style={styles.modalEmptyTitle}>No assignable vehicles</Text>
                  <Text style={styles.modalEmptyText}>
                    {selectedDriverUsesOwnVehicle
                      ? "This driver uses a personal vehicle, but no approved driver-owned vehicle is available yet."
                      : "No city or barangay vehicles are available for this driver right now."}
                  </Text>
                </View>
              )}
            </View>

            {requestToAssign ? (
              <>
                <View style={styles.assignmentSummaryCard}>
                  <Text style={styles.assignmentSummaryTitle}>Assignment Ready</Text>
                  <Text style={styles.assignmentSummaryText}>Request: {requestToAssign.title} · {getPassengerCountText(requestToAssign)}</Text>
                  <Text style={styles.assignmentSummaryText}>Driver: {selectedDriver?.name || "No driver selected"}</Text>
                  <Text style={styles.assignmentSummaryText}>
                    Vehicle: {resolvedVehicle?.name || (selectedDriverUsesOwnVehicle ? "No approved personal vehicle found" : "No city/barangay vehicle available")}
                  </Text>
                  {isScheduledFarAhead(requestToAssign, now) ? (
                    <Text style={styles.assignEarlyWarning}>
                      This ride is scheduled for {getWhenText(requestToAssign)}. If you assign it now, the driver and vehicle stay busy until the trip is done. Assign it closer to the time.
                    </Text>
                  ) : null}
                </View>

                {assignError ? (
                  <Text style={styles.assignErrorText} accessibilityRole="alert">
                    {assignError}
                  </Text>
                ) : null}

                <View style={styles.assignmentActionRow}>
                  <TouchableOpacity style={[styles.assignmentActionButton, styles.assignmentCancelButton]} onPress={handleCancelAssignModal}>
                    <Text style={styles.assignmentCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.assignmentActionButton, styles.assignButton, !resolvedVehicle && styles.actionButtonDisabled]}
                    onPress={handleAssignRequest}
                    disabled={!resolvedVehicle}
                  >
                    <Text style={styles.assignButtonText}>Assign</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* An in-app question instead of Alert.alert: Alert.alert does nothing on the website, where dispatchers work. */}
      <Modal visible={Boolean(endingCall)} transparent animationType="fade" onRequestClose={() => setEndingCall(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.endCard}>
            <Text style={styles.endTitle}>End this emergency?</Text>
            <Text style={styles.endText}>
              The card for {endingCall?.residentName || "this resident"} will close. If their alert screen is still open, it will say
              &quot;Alert closed&quot;.
            </Text>
            {endError ? <Text style={styles.endError}>{endError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.endConfirmButton, pressed && styles.endConfirmButtonPressed]}
              onPress={endEmergency}
              accessibilityRole="button"
            >
              <Text style={styles.endConfirmText}>End emergency</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}
              onPress={() => setEndingCall(null)}
              accessibilityRole="button"
            >
              <Text style={styles.outlineButtonText}>Keep it open</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(incomingCall)} transparent animationType="fade" onRequestClose={declineIncomingCall}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, compact && styles.modalCardCompact]}>
            <Text style={styles.modalTitle}>Incoming Emergency Call</Text>
            <Text style={styles.modalSubtitle}>{incomingCall?.residentName || "Resident"} is calling the dispatcher station.</Text>
            <EmergencyCallerDetails call={incomingCall} />

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
  container: { width: "100%", maxWidth: 1480, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 14 },
  sectionLabels: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" },
  sectionLabelLeft: { flexBasis: 220, maxWidth: 280, flexGrow: 1, alignItems: "flex-start" },
  sectionLabelMap: { flex: 4, minWidth: 300, alignItems: "center" },
  sectionLabelRight: { flexBasis: 220, maxWidth: 280, flexGrow: 1, alignItems: "flex-start" },
  sectionLabelText: { fontSize: 24, fontWeight: "800", color: "#06774B" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "stretch" },
  leftPanel: { flexBasis: 220, maxWidth: 280, flexGrow: 1, height: 560, padding: 12, borderRadius: 20, backgroundColor: "#E3E7E5", gap: 10 },
  sidePanelCompact: { flexBasis: "100%", maxWidth: "100%", height: "auto" },
  panelLabel: { fontSize: 16, fontWeight: "700", color: "#496B5F" },
  panelScrollArea: { flex: 1 },
  panelScrollContent: { gap: 10, paddingBottom: 2 },
  requestCard: { borderRadius: 18, padding: 16 },
  requestCardActive: { borderWidth: 2, borderColor: "#06774B" },
  requestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  requestChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, alignSelf: "flex-start" },
  requestChipText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  requestStatus: { fontSize: 13, fontWeight: "700", color: "#344640" },
  requestTitle: { marginTop: 10, fontSize: 18, fontWeight: "800", color: "#111111" },
  requestMeta: { marginTop: 10, fontSize: 12, lineHeight: 17, color: "#465752" },
  requestHelp: { marginTop: 6, fontWeight: "700", color: "#24342E" },
  whenPassed: { color: "#B42318", fontWeight: "800" },
  assignEarlyWarning: { marginTop: 12, padding: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#FFF3CD", color: "#5C3F00", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  detailsPanel: { padding: 20, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5E0" },
  detailsHeading: { fontSize: 24, fontWeight: "800", color: "#06774B" },
  detailsEmpty: { marginTop: 8, fontSize: 15, color: "#60716B" },
  detailsTop: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  detailsTitle: { fontSize: 22, fontWeight: "800", color: "#111111" },
  detailsMuted: { fontSize: 14, lineHeight: 20, color: "#60716B" },
  detailsPhoneBlock: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: "#E5F4ED", gap: 4 },
  detailsPassenger: { fontSize: 20, fontWeight: "800", color: "#111111" },
  detailsPhone: { fontSize: 32, lineHeight: 40, fontWeight: "800", letterSpacing: 0.5, color: "#06774B", fontVariant: ["tabular-nums"] },
  detailsGrid: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 18 },
  detailsItem: { flexGrow: 1, flexBasis: 240, maxWidth: 480 },
  detailsLabel: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  detailsValue: { marginTop: 4, fontSize: 16, lineHeight: 23, color: "#111111" },
  mapPanel: { flex: 4, minWidth: 360, height: 560, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D6DFDB", overflow: "hidden" },
  mapPanelCompact: { flexBasis: "100%", minWidth: 0, height: 560 },
  mapPlaceholder: { flex: 1, minHeight: 560, alignItems: "stretch", justifyContent: "flex-start", backgroundColor: "#F7F9F8" },
  mapCrossWrap: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: "#CDD6D2", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  mapCross: { fontSize: 58, lineHeight: 58, color: "#A4B0AA" },
  mapPlaceholderTitle: { marginTop: 18, fontSize: 26, fontWeight: "800", color: "#2D3934", textAlign: "center" },
  mapPlaceholderText: { marginTop: 12, maxWidth: 520, fontSize: 16, lineHeight: 24, color: "#61716B", textAlign: "center" },
  rightPanel: { flexBasis: 220, maxWidth: 280, flexGrow: 1, height: 560, padding: 12, borderRadius: 20, backgroundColor: "#E3E7E5", gap: 10 },
  // Driver cards (driver-duty-plan.md Step 5, DESIGN.md look). Flat: no shadows.
  driverCard: { padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: DESIGN_COLORS.controlOutline, backgroundColor: DESIGN_COLORS.paperWhite },
  driverCardSelected: { borderWidth: 2, borderColor: DESIGN_COLORS.hallGreen },
  driverCardPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  // Greyed out: this driver can't be given a ride now (the reason is written on the card).
  driverCardBlocked: { borderWidth: 1, borderColor: DESIGN_COLORS.rule, backgroundColor: DESIGN_COLORS.boardTint },
  driverName: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  driverNameBlocked: { color: DESIGN_COLORS.inkMuted },
  driverPlace: { marginTop: 2, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  dutyLine: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  dutyBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
  dutyBadgeText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  dutySince: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted, fontVariant: ["tabular-nums"] },
  driverMetaLine: { marginTop: 6, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.ink },
  appClosedBox: { marginTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 16, backgroundColor: DESIGN_COLORS.peachTint },
  appClosedText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  blockReasonText: { marginTop: 10, fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  assignErrorText: { marginTop: 12, padding: 12, borderRadius: 16, fontSize: 15, lineHeight: 20, fontWeight: "600", color: DESIGN_COLORS.emergencyRed, backgroundColor: DESIGN_COLORS.redTint },
  emptyRequestsCard: { padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF" },
  emptyRequestsTitle: { fontSize: 16, fontWeight: "800", color: "#24342E" },
  emptyRequestsText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#66776F" },
  emptyDriversCard: { padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF" },
  emptyDriversTitle: { fontSize: 16, fontWeight: "800", color: "#24342E" },
  emptyDriversText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#66776F" },
  actionButtonDisabled: { opacity: 0.65 },
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
  assignmentSummaryCard: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: "#F7FAF8", borderWidth: 1, borderColor: "#DCE5E0" },
  assignmentSummaryTitle: { fontSize: 16, fontWeight: "800", color: "#24342E" },
  assignmentSummaryText: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#60716B" },
  assignmentActionRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  assignmentActionButton: { flex: 1, minHeight: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  assignmentCancelButton: { backgroundColor: "#E1E7E4" },
  assignmentCancelButtonText: { fontSize: 17, fontWeight: "800", color: "#1F2E29" },
  assignButton: {
    backgroundColor: "#06774B",
  },
  assignButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 22 },
  // Emergency caller details (DESIGN.md look): big tap-to-call number, then barangay and the map link.
  callerDetails: { marginTop: 16, gap: 12 },
  callerPhoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  callerPhoneButtonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  callerPhoneText: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#FFFFFF" },
  callerLine: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  callerLabel: { fontWeight: "700" },
  callerMapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
  },
  callerMapButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  callerMapText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  // "Active emergency" card: flat sign with a red edge (it is an emergency), at most 640 wide on a computer.
  activeCard: {
    width: "100%",
    maxWidth: 640,
    padding: 16,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: DESIGN_COLORS.emergencyRed,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  activeTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  // "Needs a new driver" banner (driver-pages-plan.md Step 2b): Sakay Orange with Ink words, card corners, no shadow.
  givenBackBanner: {
    width: "100%",
    maxWidth: 640,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: DESIGN_COLORS.sakayOrange,
  },
  givenBackBannerPressed: { opacity: 0.85 },
  givenBackBannerCopy: { flex: 1 },
  givenBackBannerTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  givenBackBannerText: { marginTop: 4, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  // The same message on the ride's card in the list: a small orange box with dark words.
  givenBackTag: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, backgroundColor: DESIGN_COLORS.sakayOrange },
  givenBackTagText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  // And in Selected Request: a peach box (important info).
  givenBackBox: { marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: DESIGN_COLORS.peachTint },
  givenBackBoxText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  givenBackBoxStrong: { fontWeight: "800" },
  // White button with a clear grey edge ("End emergency" on the card, "Keep it open" in the question).
  outlineButton: {
    minHeight: 52,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  outlineButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  outlineButtonText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.ink },
  // "End this emergency?" question.
  endCard: { width: "100%", maxWidth: 440, padding: 24, borderRadius: 24, backgroundColor: DESIGN_COLORS.paperWhite },
  endTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  endText: { marginTop: 8, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  endError: { marginTop: 8, fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.emergencyRed },
  endConfirmButton: {
    minHeight: 56,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DESIGN_COLORS.emergencyRed,
  },
  endConfirmButtonPressed: { backgroundColor: "#8F1C13" },
  endConfirmText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
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
