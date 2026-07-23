import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, deleteField, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import BrandLogo from "../components/BrandLogo";
import LeafletMap from "../components/LeafletMap";
import { db } from "../firebase";
import {
  DRIVER_AVAILABILITY_SHIFT,
  DRIVER_SCHEDULE_COLLECTION,
  buildScheduleDateTime,
  getDateFromValue,
  getScheduleLifecycleStatus,
  overlapsScheduleWindow,
} from "../lib/driverScheduling";
import { saveLocalUserProfile, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

const getLocalDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const createTimeParts = (hour, minute, period) => ({
  hour,
  minute,
  period,
});

const toTimeInputValue = (timeParts) => {
  const hour12 = timeParts.hour === 12 ? 12 : timeParts.hour % 12;
  const normalizedHour = timeParts.period === "PM" ? (hour12 % 12) + 12 : hour12 === 12 ? 0 : hour12;
  return `${`${normalizedHour}`.padStart(2, "0")}:${`${timeParts.minute}`.padStart(2, "0")}`;
};

const formatClockLabel = (timeParts) => `${timeParts.hour}:${`${timeParts.minute}`.padStart(2, "0")} ${timeParts.period.toLowerCase()}`;
const defaultShiftStart = createTimeParts(8, 0, "AM");
const defaultShiftEnd = createTimeParts(5, 0, "PM");

function TimeSpinner({ label, value, onChange, compact = false }) {
  const cycleValue = (field, step, min, max) => {
    const nextValue = value[field] + step;
    const wrapped = nextValue > max ? min : nextValue < min ? max : nextValue;
    onChange({ ...value, [field]: wrapped });
  };

  return (
    <View style={[styles.timeSpinnerCard, compact && styles.timeSpinnerCardCompact]}>
      <Text style={styles.timeSpinnerTitle}>{label}</Text>
      <Text style={styles.timeSpinnerValue}>{formatClockLabel(value)}</Text>
      <View style={styles.timeSpinnerSegments}>
        <View style={styles.timeSpinnerSegment}>
          <Text style={styles.timeSpinnerSegmentLabel}>Hour</Text>
          <TouchableOpacity style={styles.timeSpinnerButton} onPress={() => cycleValue("hour", 1, 1, 12)}>
            <FontAwesome name="chevron-up" size={14} color="#234038" />
          </TouchableOpacity>
          <Text style={styles.timeSpinnerSegmentValue}>{value.hour}</Text>
          <TouchableOpacity style={styles.timeSpinnerButton} onPress={() => cycleValue("hour", -1, 1, 12)}>
            <FontAwesome name="chevron-down" size={14} color="#234038" />
          </TouchableOpacity>
        </View>

        <View style={styles.timeSpinnerSegment}>
          <Text style={styles.timeSpinnerSegmentLabel}>Minute</Text>
          <TouchableOpacity style={styles.timeSpinnerButton} onPress={() => cycleValue("minute", 5, 0, 55)}>
            <FontAwesome name="chevron-up" size={14} color="#234038" />
          </TouchableOpacity>
          <Text style={styles.timeSpinnerSegmentValue}>{`${value.minute}`.padStart(2, "0")}</Text>
          <TouchableOpacity style={styles.timeSpinnerButton} onPress={() => cycleValue("minute", -5, 0, 55)}>
            <FontAwesome name="chevron-down" size={14} color="#234038" />
          </TouchableOpacity>
        </View>

        <View style={styles.timeSpinnerSegment}>
          <Text style={styles.timeSpinnerSegmentLabel}>Period</Text>
          <TouchableOpacity
            style={styles.timeSpinnerButton}
            onPress={() => onChange({ ...value, period: value.period === "AM" ? "PM" : "AM" })}
          >
            <FontAwesome name="chevron-up" size={14} color="#234038" />
          </TouchableOpacity>
          <Text style={styles.timeSpinnerSegmentValue}>{value.period}</Text>
          <TouchableOpacity
            style={styles.timeSpinnerButton}
            onPress={() => onChange({ ...value, period: value.period === "AM" ? "PM" : "AM" })}
          >
            <FontAwesome name="chevron-down" size={14} color="#234038" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function DriverHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const narrow = width < 560;
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const { theme, toggleTheme } = useTheme();
  const [accessStatus, setAccessStatus] = useState("checking");
  const [availability, setAvailability] = useState("Unavailable");
  const [assignedTransfer, setAssignedTransfer] = useState(null);
  const [driverSchedules, setDriverSchedules] = useState([]);
  const [schedulePromptOpen, setSchedulePromptOpen] = useState(false);
  const [hasPromptedSchedule, setHasPromptedSchedule] = useState(false);
  const [scheduleStartTime, setScheduleStartTime] = useState(createTimeParts(8, 0, "AM"));
  const [scheduleEndTime, setScheduleEndTime] = useState(createTimeParts(5, 0, "PM"));
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "", phoneNumber: "", barangay: "", address: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "D";

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

  useEffect(() => {
    if (!authUser?.uid || accessStatus !== "approved") {
      setDriverSchedules([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, DRIVER_SCHEDULE_COLLECTION),
      (snapshot) => {
        const schedules = snapshot.docs
          .map((scheduleDoc) => ({
            id: scheduleDoc.id,
            ...scheduleDoc.data(),
          }))
          .filter((schedule) => schedule.driverUid === authUser.uid)
          .sort((first, second) => {
            const firstStart = getDateFromValue(first.startAt)?.getTime() ?? 0;
            const secondStart = getDateFromValue(second.startAt)?.getTime() ?? 0;
            return firstStart - secondStart;
          });

        setDriverSchedules(schedules);
      },
      (error) => console.log("Driver schedules listener warning:", error)
    );

    return unsubscribe;
  }, [accessStatus, authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid || accessStatus !== "approved" || !driverSchedules.length) {
      return undefined;
    }

    const now = new Date();
    const schedulableStatuses = ["Available", "Claimed", "On Duty"];

    driverSchedules.forEach((schedule) => {
      if (schedule.driverUid !== authUser.uid || !schedulableStatuses.includes(schedule.status)) {
        return;
      }

      const nextLifecycleStatus = getScheduleLifecycleStatus(schedule, now);

      if (nextLifecycleStatus !== schedule.status && ["On Duty", "Completed"].includes(nextLifecycleStatus)) {
        updateDoc(doc(db, DRIVER_SCHEDULE_COLLECTION, schedule.id), {
          status: nextLifecycleStatus,
          updatedAt: serverTimestamp(),
        }).catch((error) => console.log("Schedule lifecycle update warning:", error));
      }
    });

    return undefined;
  }, [accessStatus, authUser?.uid, driverSchedules]);

  useEffect(() => {
    if (accessStatus !== "approved" || hasPromptedSchedule) {
      return;
    }

    setSchedulePromptOpen(true);
    setHasPromptedSchedule(true);
  }, [accessStatus, hasPromptedSchedule]);

  const request = assignedTransfer?.request;
  const missionStatus = assignedTransfer?.status ?? "Assigned";

  const requestMapProps = useMemo(() => {
    if (!request) {
      return {
        title: "Driver Route Preview Map",
        markerLabel: "Toledo City, Cebu",
      };
    }

    const pickupCoordinates =
      typeof request.pickupLatitude === "number" && typeof request.pickupLongitude === "number"
        ? [request.pickupLatitude, request.pickupLongitude]
        : typeof request.latitude === "number" && typeof request.longitude === "number"
          ? [request.latitude, request.longitude]
          : null;
    const destinationCoordinates =
      typeof request.destinationLatitude === "number" && typeof request.destinationLongitude === "number"
        ? [request.destinationLatitude, request.destinationLongitude]
        : null;

    return {
      title: request.emergencyType ?? request.title ?? "Assigned Request Map",
      markerLabel: request.pickupLocation || "Assigned request",
      pickupLabel: request.pickupDetails
        ? `${request.pickupLocation || "Pickup"} - ${request.pickupDetails}`
        : request.pickupLocation || "Pickup location",
      destinationLabel: request.destination || "",
      pickupCoordinates,
      destinationCoordinates,
    };
  }, [request]);

  const resetScheduleForm = () => {
    setScheduleStartTime(defaultShiftStart);
    setScheduleEndTime(defaultShiftEnd);
  };

  const hasOverlappingSchedule = (candidateSchedule, ignoredScheduleId = "") =>
    driverSchedules.some((existingSchedule) => {
      if (existingSchedule.id === ignoredScheduleId) {
        return false;
      }

      if (existingSchedule.driverUid !== authUser?.uid) {
        return false;
      }

      if (["Cancelled", "Completed"].includes(existingSchedule.status)) {
        return false;
      }

      return overlapsScheduleWindow(candidateSchedule, existingSchedule);
    });

  const handleAddSchedule = async () => {
    setScheduleError("");
    setScheduleMessage("");

    if (!authUser?.uid) {
      setScheduleError("Login is required before adding a schedule.");
      return;
    }

    const activeScheduleDate = getLocalDateValue();
    const startAt = buildScheduleDateTime(activeScheduleDate, toTimeInputValue(scheduleStartTime));
    const endAt = buildScheduleDateTime(activeScheduleDate, toTimeInputValue(scheduleEndTime));
    const now = new Date();
    const defaultStartAt = buildScheduleDateTime(activeScheduleDate, toTimeInputValue(defaultShiftStart));
    const defaultEndAt = buildScheduleDateTime(activeScheduleDate, toTimeInputValue(defaultShiftEnd));
    const scheduleTags = [
      ...(defaultStartAt && startAt > defaultStartAt ? ["Late In"] : []),
      ...(defaultEndAt && endAt < defaultEndAt ? ["Early Out"] : []),
      ...(endAt && endAt <= now ? ["Late Submission"] : []),
    ];

    if (!startAt || !endAt || endAt <= startAt) {
      setScheduleError("Schedule times are invalid. End time must be after start time.");
      return;
    }

    const nextSchedule = {
      driverUid: authUser.uid,
      startAt,
      endAt,
      status: "Available",
    };

    if (hasOverlappingSchedule(nextSchedule)) {
      setScheduleError("This schedule overlaps with another existing shift or availability window.");
      return;
    }

    setIsSavingSchedule(true);

    try {
      const scheduleRef = doc(collection(db, DRIVER_SCHEDULE_COLLECTION));
      await setDoc(scheduleRef, {
        driverUid: authUser.uid,
        driverName: profile?.fullName ?? displayName,
        date: activeScheduleDate,
        startTime: toTimeInputValue(scheduleStartTime),
        endTime: toTimeInputValue(scheduleEndTime),
        startAt,
        endAt,
        status: endAt <= now ? "Completed" : startAt <= now ? "On Duty" : "Available",
        scheduleTags,
        shiftType: DRIVER_AVAILABILITY_SHIFT,
        createdByUid: authUser.uid,
        createdByName: profile?.fullName ?? displayName,
        createdByRole: "Driver",
        claimedByUid: authUser.uid,
        claimedByName: profile?.fullName ?? displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setScheduleMessage(scheduleTags.length ? `Availability saved with tags: ${scheduleTags.join(", ")}.` : "Availability saved.");
      setSchedulePromptOpen(false);
      resetScheduleForm();
    } catch (error) {
      console.log("Driver schedule save failed:", error);
      setScheduleError("Schedule could not be saved. Please check Firestore permissions.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const updateMissionStatus = async (nextStatus) => {
    if (!assignedTransfer?.id) {
      return;
    }

    const requestId = assignedTransfer.requestId;
    const vehicleId = assignedTransfer.vehicleId;

    try {
      await updateDoc(doc(db, "driverAssignments", assignedTransfer.id), {
        status: nextStatus,
        ...(nextStatus === "In Progress" ? { acceptedAt: serverTimestamp() } : {}),
        ...(nextStatus === "Completed" ? { completedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });

      if (requestId) {
        await updateDoc(doc(db, "transportRequests", requestId), {
          status: nextStatus,
          ...(nextStatus === "In Progress" ? { acceptedAt: serverTimestamp() } : {}),
          ...(nextStatus === "Completed" ? { completedAt: serverTimestamp() } : {}),
          updatedAt: serverTimestamp(),
        });
      }

      if (vehicleId) {
        await updateDoc(doc(db, "vehicles", vehicleId), {
          status: nextStatus === "In Progress" ? "In Use" : nextStatus === "Completed" ? (availability === "Available" ? "Available" : "Inactive") : "Assigned",
          ...(nextStatus === "Completed"
            ? {
                assignedDriverId: deleteField(),
                assignedRequestId: deleteField(),
              }
            : {}),
          updatedAt: serverTimestamp(),
        });
      }

      const matchingSchedule = driverSchedules.find(
        (schedule) =>
          schedule.driverUid === authUser?.uid &&
          ["Available", "Claimed", "On Duty"].includes(schedule.status) &&
          (getDateFromValue(schedule.startAt)?.getTime() ?? 0) <= Date.now() &&
          (getDateFromValue(schedule.endAt)?.getTime() ?? 0) >= Date.now()
      );

      if (matchingSchedule?.id) {
        await updateDoc(doc(db, DRIVER_SCHEDULE_COLLECTION, matchingSchedule.id), {
          status: nextStatus === "Completed" ? "Completed" : "On Duty",
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
          assignedDriverId: deleteField(),
          assignedDriverName: deleteField(),
          assignedVehicleId: deleteField(),
          assignedVehicleName: deleteField(),
          vehicleId: deleteField(),
          vehicle: deleteField(),
          vehiclePlateNumber: deleteField(),
          lastDeclinedDriverId: authUser?.uid ?? "",
          lastDeclinedDriverName: displayName,
          updatedAt: serverTimestamp(),
        });
      }

      if (assignedTransfer.vehicleId) {
        await updateDoc(doc(db, "vehicles", assignedTransfer.vehicleId), {
          status: availability === "Available" ? "Available" : "Inactive",
          assignedDriverId: deleteField(),
          assignedRequestId: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }

      const matchingSchedule = driverSchedules.find(
        (schedule) => schedule.driverUid === authUser?.uid && ["Claimed", "On Duty"].includes(schedule.status)
      );

      if (matchingSchedule?.id) {
        await updateDoc(doc(db, DRIVER_SCHEDULE_COLLECTION, matchingSchedule.id), {
          status: "Available",
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.log("Mission decline failed:", error);
    }
  };

  const menuItems = [
    { key: "profile", label: "Profile", icon: "user", action: () => { setProfileMenuOpen(false); setProfileEditorOpen(true); } },
  ];

  useEffect(() => {
    if (!profileEditorOpen) {
      return;
    }

    setProfileError("");
    setProfileMessage("");
    setProfileForm({
      fullName: profile?.fullName || displayName,
      phoneNumber: profile?.phoneNumber || profile?.phone || "",
      barangay: profile?.barangay || "",
      address: profile?.address || "",
    });
  }, [displayName, profile?.address, profile?.barangay, profile?.fullName, profile?.phone, profile?.phoneNumber, profileEditorOpen]);

  const saveDriverProfile = async () => {
    if (!authUser?.uid) {
      setProfileError("Login is required before updating your profile.");
      return;
    }

    if (!profileForm.fullName.trim() || !profileForm.phoneNumber.trim() || !profileForm.barangay.trim()) {
      setProfileError("Full name, phone number, and barangay are required.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");

    try {
      await updateDoc(doc(db, "users", authUser.uid), {
        fullName: profileForm.fullName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        phone: profileForm.phoneNumber.trim(),
        barangay: profileForm.barangay.trim(),
        address: profileForm.address.trim(),
        updatedAt: serverTimestamp(),
      });

      saveLocalUserProfile({
        uid: authUser.uid,
        email: authUser.email || profile?.email || "",
        fullName: profileForm.fullName.trim(),
        barangay: profileForm.barangay.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        phone: profileForm.phoneNumber.trim(),
        role: "Driver",
        accountStatus: "Approved",
      });

      setProfileMessage("Profile updated successfully.");
      setProfileEditorOpen(false);
    } catch (error) {
      console.log("Driver profile save failed:", error);
      setProfileError("Profile could not be updated. Please check Firestore permissions.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (accessStatus !== "approved") {
    return (
      <View style={[styles.accessPage, { backgroundColor: theme.page }]}>
        <ActivityIndicator color="#06774B" />
        <Text style={[styles.accessText, { color: theme.mutedText }]}>Checking driver access...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.page, { backgroundColor: theme.page }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
          <BrandLogo variant="main" height={compact ? 30 : 36} />

          <View style={[styles.headerRight, narrow && styles.headerRightCompact]}>
            <TouchableOpacity style={[styles.profileTrigger, { backgroundColor: theme.headerBg }]} onPress={() => setProfileMenuOpen(true)}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.avatarBg }]}>
                <Text style={[styles.avatarText, { color: theme.avatarText }]}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.container, compact && styles.containerCompact]}>
          <View style={[styles.statusBar, availability === "Unavailable" && styles.statusBarUnavailable]}>
            <View style={styles.statusLeft}>
              <View style={[styles.statusDot, availability === "Unavailable" && styles.statusDotUnavailable]} />
              <View>
                <Text style={[styles.statusText, compact && styles.statusTextCompact]}>{availability}</Text>
                <Text style={styles.statusSubtext}>{availability === "Available" ? "Online and ready for dispatch" : "Offline or inactive"}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.scheduleLaunchButton} onPress={() => setSchedulePromptOpen(true)}>
              <Text style={styles.scheduleLaunchButtonText}>Set Availability</Text>
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
                        <FontAwesome name="map-marker" size={26} color="#111111" />
                        <Text style={styles.locationText}>{request.pickupLocation || "Pickup location pending"}</Text>
                      </View>
                    </View>

                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>Destination</Text>
                      <View style={styles.locationRow}>
                        <FontAwesome name="flag" size={20} color="#111111" />
                        <Text style={styles.locationText}>{request.destination}</Text>
                      </View>
                    </View>

                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>Trip Summary</Text>
                      <Text style={styles.summaryText}>{request.summary}</Text>
                      <Text style={styles.requestMeta}>{request.level} | {request.emergencyType ?? request.title} | {request.vehicle || "Vehicle pending"}</Text>
                    </View>
                  </View>

                  <View style={styles.mapCard}>
                    <View style={styles.mapCardHeader}>
                      <Text style={styles.mapCardTitle}>{request.emergencyType ?? request.title ?? "Patient Transfer"}</Text>
                      <View style={styles.mapHeaderButton}>
                        <Text style={styles.mapHeaderButtonText}>{missionStatus}</Text>
                      </View>
                    </View>

                    <View style={styles.mapBlankState}>
                      <LeafletMap {...requestMapProps} />
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
                  <FontAwesome name="envelope-o" size={54} color="#8EA098" />
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

        <Modal visible={schedulePromptOpen} transparent animationType="fade" onRequestClose={() => setSchedulePromptOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.scheduleModalCard, compact && styles.scheduleModalCardCompact]}>
              <View style={styles.scheduleModalHeader}>
                <View>
                  <Text style={styles.scheduleModalTitle}>Add Availability</Text>
                  <Text style={styles.scheduleModalSubtitle}>Date: {new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text>
                </View>
                <TouchableOpacity style={styles.modalCloseCircle} onPress={() => setSchedulePromptOpen(false)}>
                  <Text style={styles.modalCloseCircleText}>X</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.scheduleModalHint}>Set today&apos;s working window using the up/down controls, then save it for dispatcher visibility.</Text>

              <View style={[styles.scheduleSpinnerRow, narrow && styles.scheduleSpinnerRowCompact]}>
                <TimeSpinner label="Start" value={scheduleStartTime} onChange={setScheduleStartTime} compact={narrow} />
                <Text style={styles.scheduleRangeDash}>-</Text>
                <TimeSpinner label="End" value={scheduleEndTime} onChange={setScheduleEndTime} compact={narrow} />
              </View>

              {scheduleError ? <Text style={styles.scheduleErrorText}>{scheduleError}</Text> : null}
              {scheduleMessage ? <Text style={styles.scheduleMessageText}>{scheduleMessage}</Text> : null}

              <TouchableOpacity style={[styles.schedulePrimaryButton, isSavingSchedule && styles.actionButtonDisabled]} onPress={handleAddSchedule} disabled={isSavingSchedule}>
                <Text style={styles.schedulePrimaryButtonText}>{isSavingSchedule ? "Saving..." : "Save Availability"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => setProfileMenuOpen(false)}>
          <Pressable style={[styles.menuOverlay, { backgroundColor: theme.menuOverlay }]} onPress={() => setProfileMenuOpen(false)}>
            <Pressable style={[styles.profileMenuCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]} onPress={() => {}}>
              <View style={[styles.profileMenuHeader, { borderBottomColor: theme.border }]}>
                <View style={[styles.profileMenuAvatar, { backgroundColor: theme.avatarBg }]}>
                  <Text style={[styles.profileMenuAvatarText, { color: theme.avatarText }]}>{initials}</Text>
                </View>
                <Text style={[styles.profileMenuName, { color: theme.text }]}>{displayName}</Text>
                <Text style={[styles.profileMenuEmail, { color: theme.secondaryText }]}>{profile?.email || authUser?.email || "Driver account"}</Text>
              </View>

              <View style={styles.profileMenuBody}>
                {menuItems.map((item) => (
                  <TouchableOpacity key={item.key} style={styles.menuItem} onPress={item.action}>
                    <View style={styles.menuItemLeft}>
                    <FontAwesome name={item.icon} size={18} color={theme.mutedText} />
                      <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <View style={styles.menuItem}>
                  <View style={styles.menuItemLeft}>
                  <FontAwesome name={theme.mode === "Dark" ? "moon-o" : "sun-o"} size={18} color={theme.mutedText} />
                    <Text style={[styles.menuItemText, { color: theme.text }]}>Dark / Light</Text>
                  </View>
                  <TouchableOpacity style={[styles.themePill, { backgroundColor: theme.themePillBg }]} onPress={toggleTheme}>
                    <Text style={[styles.themePillText, { color: theme.themePillText }]}>{theme.mode}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.logoutMenuButton}
                onPress={() => {
                  setProfileMenuOpen(false);
                  router.replace("/login");
                }}
              >
                <Text style={styles.logoutMenuButtonText}>Log Out</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={profileEditorOpen} transparent animationType="fade" onRequestClose={() => setProfileEditorOpen(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
            <View style={[styles.profileEditorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TouchableOpacity style={styles.modalCloseCircle} onPress={() => setProfileEditorOpen(false)}>
                <Text style={styles.modalCloseCircleText}>X</Text>
              </TouchableOpacity>

              <Text style={[styles.reviewTitle, { color: theme.text }]}>Profile</Text>
              <Text style={[styles.profileEditorSubtitle, { color: theme.mutedText }]}>Update your driver profile details used by dispatch and admin records.</Text>

              <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                value={profileForm.fullName}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))}
                placeholder="Full name"
                placeholderTextColor={theme.subtleText}
              />

              <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                value={profileForm.phoneNumber}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, phoneNumber: value }))}
                placeholder="Phone number"
                placeholderTextColor={theme.subtleText}
                keyboardType="phone-pad"
              />

              <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                value={profileForm.barangay}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, barangay: value }))}
                placeholder="Barangay"
                placeholderTextColor={theme.subtleText}
              />

              <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Address</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                value={profileForm.address}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, address: value }))}
                placeholder="Street or landmark"
                placeholderTextColor={theme.subtleText}
              />

              {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
              {profileMessage ? <Text style={styles.feedbackText}>{profileMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.primarySaveButton, savingProfile && styles.actionButtonDisabled]}
                onPress={saveDriverProfile}
                disabled={savingProfile}
              >
                <Text style={styles.primarySaveButtonText}>{savingProfile ? "Saving..." : "Save Changes"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  accessPage: { flex: 1, backgroundColor: "#F5F7F6", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  accessText: { fontSize: 15, fontWeight: "800", color: "#335E50", textAlign: "center" },
  content: { paddingBottom: 24 },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRightCompact: {
    width: "100%",
    justifyContent: "space-between",
  },
  profileTrigger: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "900",
  },
  container: { width: "100%", maxWidth: 1280, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 16 },
  statusBar: {
    backgroundColor: "#0B7A4A",
    borderRadius: 18,
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
  scheduleLaunchButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#EAF4EF", alignItems: "center", justifyContent: "center" },
  scheduleLaunchButtonText: { fontSize: 14, fontWeight: "800", color: "#0B7A4A" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  assignmentPanel: { flex: 3, minWidth: 280, padding: 20, borderRadius: 18, backgroundColor: "#E3E7E5" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  badge: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "#FB7A2E" },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  assignmentStatus: { fontSize: 14, fontWeight: "700", color: "#567167" },
  assignmentTitle: { marginTop: 14, fontSize: 38, fontWeight: "800", color: "#111111" },
  assignmentTitleCompact: { fontSize: 30 },
  assignmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "stretch" },
  leftColumn: { flex: 1, minWidth: 260, gap: 14 },
  missionCard: { padding: 18, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E2DD" },
  missionCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  missionEyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: "#5A7267" },
  missionStatusPill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#EAF4EF" },
  missionStatusText: { fontSize: 12, fontWeight: "800", color: "#06774B" },
  missionTitle: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#111111" },
  missionText: { marginTop: 8, fontSize: 15, lineHeight: 22, color: "#475652" },
  infoCard: { padding: 18, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E2DD" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111111" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  locationText: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1C2723" },
  summaryText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#475652" },
  requestMeta: { marginTop: 12, fontSize: 13, fontWeight: "700", color: "#60716B" },
  mapCard: { flex: 0.82, minWidth: 280, maxWidth: 460, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEDA", overflow: "hidden" },
  mapCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E4EBE7", gap: 12, flexWrap: "wrap" },
  mapCardTitle: { fontSize: 18, fontWeight: "700", color: "#2E3C37" },
  mapHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  mapHeaderButtonText: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  mapBlankState: { minHeight: 280, aspectRatio: 1, alignItems: "stretch", justifyContent: "flex-start" },
  mapBlankTitle: { marginTop: 14, fontSize: 24, fontWeight: "800", color: "#2F3B46", textAlign: "center" },
  mapBlankText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  driverActionRow: { padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 10, borderTopWidth: 1, borderTopColor: "#E4EBE7", backgroundColor: "#FFFFFF" },
  driverActionButton: { flexGrow: 1, minWidth: 120, minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  acceptButton: { backgroundColor: "#06774B" },
  declineButton: { backgroundColor: "#C53A3A" },
  reviewButton: { backgroundColor: "#326CD0" },
  completeButton: { backgroundColor: "#FB7A2E" },
  driverActionButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  emptyInbox: { marginTop: 20, minHeight: 300, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24, borderWidth: 1, borderColor: "#D8E2DD" },
  emptyTitle: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#2F3B46" },
  emptyText: { marginTop: 8, maxWidth: 360, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  scheduleModalCard: { width: "100%", maxWidth: 760, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E2DD", padding: 22 },
  scheduleModalCardCompact: { padding: 18 },
  scheduleModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  scheduleModalTitle: { fontSize: 26, fontWeight: "800", color: "#111111" },
  scheduleModalSubtitle: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#60716B" },
  scheduleModalHint: { marginTop: 14, fontSize: 14, lineHeight: 21, color: "#4D5D57" },
  scheduleSpinnerRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  scheduleSpinnerRowCompact: { flexDirection: "column" },
  scheduleRangeDash: { fontSize: 34, fontWeight: "800", color: "#60716B" },
  timeSpinnerCard: { flex: 1, minWidth: 240, padding: 16, borderRadius: 18, backgroundColor: "#F8FBF9", borderWidth: 1, borderColor: "#D8E2DD" },
  timeSpinnerCardCompact: { width: "100%", minWidth: 0 },
  timeSpinnerTitle: { fontSize: 16, fontWeight: "800", color: "#20332D" },
  timeSpinnerValue: { marginTop: 8, fontSize: 24, fontWeight: "900", color: "#0B7A4A" },
  timeSpinnerSegments: { marginTop: 14, flexDirection: "row", gap: 10 },
  timeSpinnerSegment: { flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DEE6E2" },
  timeSpinnerSegmentLabel: { fontSize: 12, fontWeight: "700", color: "#6A7C75" },
  timeSpinnerButton: { marginTop: 8, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF4EF" },
  timeSpinnerSegmentValue: { marginVertical: 8, fontSize: 18, fontWeight: "900", color: "#20332D" },
  scheduleErrorText: { marginTop: 12, fontSize: 13, lineHeight: 19, color: "#B42318", fontWeight: "700" },
  scheduleMessageText: { marginTop: 12, fontSize: 13, lineHeight: 19, color: "#06774B", fontWeight: "700" },
  schedulePrimaryButton: { marginTop: 16, minHeight: 48, borderRadius: 12, backgroundColor: "#06774B", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  schedulePrimaryButtonText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  actionButtonDisabled: { opacity: 0.65 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", justifyContent: "center", padding: 20 },
  reviewCard: { width: "100%", maxWidth: 520, padding: 22, borderRadius: 20, backgroundColor: "#FFFFFF" },
  reviewCardCompact: { padding: 18 },
  reviewTitle: { fontSize: 26, fontWeight: "800", color: "#111111" },
  reviewLine: { marginTop: 12, fontSize: 15, lineHeight: 22, color: "#40504A" },
  reviewCloseButton: { marginTop: 22, minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#06774B" },
  reviewCloseButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)", paddingTop: 86, paddingRight: 18, alignItems: "flex-end" },
  profileMenuCard: {
    width: 320,
    maxWidth: "92%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  profileMenuHeader: { alignItems: "center", paddingBottom: 16, borderBottomWidth: 1 },
  profileMenuAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  profileMenuAvatarText: { fontSize: 22, fontWeight: "900" },
  profileMenuName: { marginTop: 12, fontSize: 18, fontWeight: "800" },
  profileMenuEmail: { marginTop: 4, fontSize: 13 },
  profileMenuBody: { paddingTop: 12, gap: 4 },
  menuItem: { minHeight: 48, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuItemText: { fontSize: 15, fontWeight: "700" },
  themePill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  themePillText: { fontSize: 12, fontWeight: "800" },
  logoutMenuButton: { marginTop: 14, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0B7A4A" },
  logoutMenuButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  profileEditorCard: { width: "100%", maxWidth: 520, borderRadius: 20, borderWidth: 1, padding: 22 },
  modalCloseCircle: { alignSelf: "flex-end", width: 42, height: 42, borderRadius: 21, backgroundColor: "#F51D1D", alignItems: "center", justifyContent: "center" },
  modalCloseCircleText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  profileEditorSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  profileFieldLabel: { marginTop: 20, fontSize: 15, fontWeight: "700" },
  profileInput: { marginTop: 10, minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15, color: "#111111" },
  primarySaveButton: { marginTop: 28, minHeight: 52, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#06774B" },
  primarySaveButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  feedbackText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#335E50" },
  errorText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#B42318" },
});
