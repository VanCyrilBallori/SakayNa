import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "../components/BrandLogo";
import CloseButton from "../components/ui/CloseButton";
import DriverDutyCard from "../features/driver/components/DriverDutyCard";
import DriverMissionActions from "../features/driver/components/DriverMissionActions";
import DriverRideCard from "../features/driver/components/DriverRideCard";
import { clearCancelledRide } from "../features/driver/services/driverMissionService";
import { getDestinationCoordinates, getMissionStatus, getPickupCoordinates } from "../features/driver/utils/driverMissionMapper";
import { getAssistanceText, getPassengerCountText, getPassengerName, getWhenText } from "../features/resident/utils/requestMapper";
import { normalizePhilippinePhone } from "../features/resident/utils/requestValidation";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import LeafletMap from "../components/LeafletMap";
import { DESIGN_COLORS } from "../constants/design";
import { auth, db } from "../firebase";
import {
  DRIVER_AVAILABILITY_SHIFT,
  DRIVER_SCHEDULE_COLLECTION,
  buildScheduleDateTime,
  getDateFromValue,
  getScheduleLifecycleStatus,
  overlapsScheduleWindow,
} from "../lib/driverScheduling";
import { startPhoneCall } from "../lib/phoneCall";
import { getAuthErrorMessage, logoutCurrentUser, saveLocalUserProfile, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

// The assigned vehicle's name. (Old requests saved the passenger count in "vehicle", so that field is not used here.)
const getVehicleName = (request, assignment) => request?.assignedVehicleName || assignment?.vehicleName || "Vehicle pending";

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
  const insets = useSafeAreaInsets();
  const compact = width < 980;
  const narrow = width < 560;
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const { theme } = useTheme();

  const initials = useMemo(() => {
    const words = displayName.split(" ").filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "D";
  }, [displayName]);
  const [accessStatus, setAccessStatus] = useState("checking");
  const [duty, setDuty] = useState({ dutyStatus: "Off duty", dutyStatusSince: null, shiftId: "", breakType: "", breakNote: "" });
  const [assignedTransfer, setAssignedTransfer] = useState(null);
  const [currentMissionRequest, setCurrentMissionRequest] = useState(null);
  const [missionMessage, setMissionMessage] = useState({ message: "", tone: "info" });
  // Shown after a ride was cancelled by the resident and removed: { title, reason }.
  const [cancelledNotice, setCancelledNotice] = useState(null);
  const [driverSchedules, setDriverSchedules] = useState([]);
  const [schedulePromptOpen, setSchedulePromptOpen] = useState(false);
  const [scheduleStartTime, setScheduleStartTime] = useState(createTimeParts(8, 0, "AM"));
  const [scheduleEndTime, setScheduleEndTime] = useState(createTimeParts(5, 0, "PM"));
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ fullName: "", phoneNumber: "", barangay: "", address: "", email: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

    // "presence" only means "is the driver's app open right now?" (driver-duty-plan.md).
    // Whether the driver can get rides is their duty status (Punch in / Punch out), not this.
    setDoc(
      userRef,
      {
        presence: "Online",
        email: authUser.email ?? profile?.email ?? "",
        fullName: profile?.fullName ?? displayName,
        role: "Driver",
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => console.log("Driver presence setup warning:", error));

    // The duty status card reads the driver's status from here. No status yet = never punched in = "Off duty".
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data({ serverTimestamps: "estimate" });
        setDuty({
          dutyStatus: data?.dutyStatus ?? "Off duty",
          dutyStatusSince: data?.dutyStatusSince ?? null,
          shiftId: data?.shiftId ?? "",
          breakType: data?.breakType ?? "",
          breakNote: data?.breakNote ?? "",
        });
      },
      (error) => console.log("Driver duty status listener warning:", error)
    );

    const markAppClosed = () => {
      setDoc(
        userRef,
        {
          presence: "Offline",
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((error) => console.log("Driver presence offline warning:", error));
    };

    const markAppOpen = () => {
      setDoc(
        userRef,
        {
          presence: "Online",
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((error) => console.log("Driver presence online warning:", error));
    };

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        markAppOpen();
        return;
      }

      markAppClosed();
    });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", markAppOpen);
      window.addEventListener("offline", markAppClosed);
      window.addEventListener("beforeunload", markAppClosed);
    }

    return () => {
      unsubscribe();
      appStateSubscription.remove();

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", markAppOpen);
        window.removeEventListener("offline", markAppClosed);
        window.removeEventListener("beforeunload", markAppClosed);
      }

      markAppClosed();
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
    if (!assignedTransfer?.requestId || accessStatus !== "approved") {
      setCurrentMissionRequest(null);
      return undefined;
    }
    const unsubscribe = onSnapshot(doc(db, "transportRequests", assignedTransfer.requestId), (snapshot) => setCurrentMissionRequest(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), () => setCurrentMissionRequest(null));
    return unsubscribe;
  }, [accessStatus, assignedTransfer?.requestId]);

  // The resident cancelled this ride while it was still "Assigned" (Skills/resident.md #1).
  // Free the driver and the vehicle right away, so the dispatcher can use them again,
  // and keep a note so the driver knows why the ride disappeared.
  // No internet: it tries again the next time the app opens and sees the cancelled ride.
  const cancelledAssignmentId =
    assignedTransfer?.id && currentMissionRequest?.status === "Cancelled" && currentMissionRequest.id === assignedTransfer.requestId
      ? assignedTransfer.id
      : null;
  const cancelledTitle = currentMissionRequest?.title || "Transport request";
  const cancelledReason = currentMissionRequest?.cancellationReason || "";
  useEffect(() => {
    if (!cancelledAssignmentId) return;
    // If this runs twice, the second run finds nothing left to free and shows nothing.
    clearCancelledRide({ assignmentId: cancelledAssignmentId })
      .then((freed) => {
        if (freed) setCancelledNotice({ title: cancelledTitle, reason: cancelledReason });
      })
      .catch((error) => console.log("Free cancelled ride warning:", error));
  }, [cancelledAssignmentId, cancelledTitle, cancelledReason]);
  useEffect(() => {
    if (!authUser?.uid || accessStatus !== "approved") {
      setAssignmentHistory([]);
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
          .sort((first, second) => {
            const firstTime = first.updatedAt?.toMillis?.() ?? first.createdAt?.toMillis?.() ?? 0;
            const secondTime = second.updatedAt?.toMillis?.() ?? second.createdAt?.toMillis?.() ?? 0;
            return secondTime - firstTime;
          });

        setAssignmentHistory(assignments);
      },
      (error) => console.log("Driver assignment history warning:", error)
    );

    return unsubscribe;
  }, [accessStatus, authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid || accessStatus !== "approved") {
      setDriverSchedules([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, DRIVER_SCHEDULE_COLLECTION), where("driverUid", "==", authUser.uid)),
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

  const request = currentMissionRequest ?? assignedTransfer?.request;
  const missionStatus = getMissionStatus(assignedTransfer || {});

  const requestMapProps = useMemo(() => {
    if (!request) {
      return {
        title: "Driver Route Preview Map",
        markerLabel: "Toledo City, Cebu",
      };
    }

    // Same helpers the "Open pickup" button uses: they read the resident's pin (pickup.latitude) first.
    const pickupCoordinates = getPickupCoordinates(request);
    const destinationCoordinates = getDestinationCoordinates(request);

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

  const menuItems = [
    { key: "profile", label: "Profile", icon: "user", action: () => { setProfileMenuOpen(false); setProfileEditorOpen(true); } },
    { key: "history", label: "History", icon: "clock-o", action: () => { setProfileMenuOpen(false); setHistoryOpen(true); } },
    { key: "settings", label: "Settings", icon: "cog", action: () => { setProfileMenuOpen(false); setSettingsOpen(true); } },
  ];

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    setProfileError("");
    setProfileMessage("");
    setSettingsForm({
      fullName: profile?.fullName || displayName,
      phoneNumber: profile?.phoneNumber || profile?.phone || "",
      barangay: profile?.barangay || "",
      address: profile?.address || "",
      email: profile?.email || authUser?.email || "",
    });
  }, [authUser?.email, displayName, profile?.address, profile?.barangay, profile?.email, profile?.fullName, profile?.phone, profile?.phoneNumber, settingsOpen]);

  useEffect(() => {
    if (!changePasswordOpen) {
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setProfileError("");
    setProfileMessage("");
  }, [changePasswordOpen]);

  const saveDriverSettings = async () => {
    if (!authUser?.uid) {
      setProfileError("Login is required before updating your profile.");
      return;
    }

    if (!settingsForm.fullName.trim() || !settingsForm.phoneNumber.trim() || !settingsForm.email.trim()) {
      setProfileError("Full name, phone number, and email are required.");
      return;
    }

    // Same phone check as sign-up. A valid number is saved in one standard style (+639171234567).
    const nextPhone = normalizePhilippinePhone(settingsForm.phoneNumber);
    if (!nextPhone) {
      setProfileError("Enter a mobile number like 0917 123 4567.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const currentAuthUser = auth.currentUser ?? authUser;
      const nextEmail = settingsForm.email.trim().toLowerCase();

      if (nextEmail !== (authUser.email || profile?.email || "").trim().toLowerCase()) {
        await updateEmail(currentAuthUser, nextEmail);
      }

      await updateDoc(doc(db, "users", authUser.uid), {
        fullName: settingsForm.fullName.trim(),
        phoneNumber: nextPhone,
        phone: nextPhone,
        // Barangay is not saved here: it is locked after sign-up. Only an Admin can change it.
        address: settingsForm.address.trim(),
        email: nextEmail,
        updatedAt: serverTimestamp(),
      });

      saveLocalUserProfile({
        uid: authUser.uid,
        email: nextEmail,
        fullName: settingsForm.fullName.trim(),
        barangay: profile?.barangay || "",
        phoneNumber: nextPhone,
        phone: nextPhone,
        role: "Driver",
        accountStatus: "Approved",
      });

      setProfileMessage("Settings updated successfully.");
      setSettingsOpen(false);
    } catch (error) {
      console.log("Driver settings save failed:", error);

      if (error?.code === "auth/requires-recent-login") {
        setProfileError("Please log in again before changing your email address.");
      } else if (error?.code === "auth/invalid-email") {
        setProfileError("Please enter a valid email address.");
      } else if (error?.code === "auth/email-already-in-use") {
        setProfileError("That email address is already being used by another account.");
      } else {
        setProfileError("Settings could not be updated. Please check Firestore permissions and your email details.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const saveDriverPassword = async () => {
    if (!authUser?.email) {
      setProfileError("This account has no email address available for password update.");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setProfileError("Enter your current password, new password, and confirm password.");
      return;
    }

    if (newPassword.length < 6) {
      setProfileError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setProfileError("New password and confirm password do not match.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const currentAuthUser = auth.currentUser ?? authUser;
      const credential = EmailAuthProvider.credential(authUser.email, currentPassword);
      await reauthenticateWithCredential(currentAuthUser, credential);
      await updatePassword(currentAuthUser, newPassword);
      setProfileMessage("Password updated successfully.");
      setChangePasswordOpen(false);
    } catch (error) {
      console.log("Driver password update failed:", error);

      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setProfileError("Current password is incorrect.");
      } else if (error?.code === "auth/requires-recent-login") {
        setProfileError("Please log in again before changing your password.");
      } else {
        setProfileError("Password could not be updated. Please check your password details.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const formatDateValue = (value) => {
    if (!value?.toDate) {
      return "Not available";
    }

    return value.toDate().toLocaleString();
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

          <View style={styles.headerRight}>
            <TouchableOpacity style={[styles.profileTrigger, { backgroundColor: theme.headerBg }]} onPress={() => setProfileMenuOpen(true)}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.avatarBg }]}>
                <Text style={[styles.avatarText, { color: theme.avatarText }]}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.container, compact && styles.containerCompact]}>
          <DriverDutyCard
            driverId={authUser.uid}
            driverName={profile?.fullName || displayName}
            duty={duty}
            activeRideStatus={assignedTransfer?.status ?? ""}
            rideTitle={request?.title || assignedTransfer?.title || ""}
          />

          <View style={styles.mainGrid}>
            <View style={styles.assignmentPanel}>
              {/* Ride Inbox header (driver-home-restyle-plan.md Piece 2). The pill is a label, not a button. */}
              <View style={styles.panelHeader}>
                <View style={styles.inboxPill}>
                  <Text style={styles.inboxPillText}>Ride Inbox</Text>
                </View>
                <Text style={styles.assignmentStatus}>
                  {!assignedTransfer ? "No ride yet" : assignedTransfer.status === "Assigned" ? "New from dispatch" : "Ride in progress"}
                </Text>
              </View>

              <Text style={styles.assignmentTitle} accessibilityRole="header">Current ride</Text>

              {cancelledNotice ? (
                <View style={styles.cancelledNotice} accessibilityRole="alert">
                  <FontAwesome name="ban" size={24} color="#B42318" />
                  <View style={styles.cancelledNoticeCopy}>
                    <Text style={styles.cancelledNoticeTitle}>The resident cancelled this ride: {cancelledNotice.title}</Text>
                    {cancelledNotice.reason ? <Text style={styles.cancelledNoticeText}>Reason: {cancelledNotice.reason}</Text> : null}
                    <Text style={styles.cancelledNoticeText}>It was removed from your rides. You and the vehicle are free again.</Text>
                    <TouchableOpacity style={styles.cancelledNoticeButton} onPress={() => setCancelledNotice(null)} accessibilityRole="button">
                      <Text style={styles.cancelledNoticeButtonText}>OK</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {request ? (
                <View style={styles.assignmentGrid}>
                  <View style={styles.leftColumn}>
                    {/* The task card (driver-home-restyle-plan.md Piece 3). Replaces the five small boxes. */}
                    <DriverRideCard
                      request={request}
                      assignment={assignedTransfer}
                      missionStatus={missionStatus}
                      vehicleName={getVehicleName(request, assignedTransfer)}
                      onOpenDetails={() => setReviewOpen(true)}
                    />
                  </View>

                  <View style={styles.mapCard}>
                    <View style={styles.mapCardHeader}>
                      <Text style={styles.mapCardTitle}>{request.emergencyType ?? request.title ?? "Current Ride"}</Text>
                      <View style={styles.mapHeaderButton}>
                        <Text style={styles.mapHeaderButtonText}>{missionStatus}</Text>
                      </View>
                    </View>

                    <View style={styles.mapBlankState}>
                      <LeafletMap {...requestMapProps} />
                    </View>

                    <FeedbackMessage message={missionMessage.message} tone={missionMessage.tone} />
                    {/* A ride the resident just cancelled has no Accept / Decline: it is being removed (see cancelledAssignmentId). */}
                    {request.status === "Cancelled" ? (
                      <FeedbackMessage message="The resident cancelled this ride. Removing it..." tone="error" />
                    ) : (
                      <DriverMissionActions assignment={{ ...assignedTransfer, currentRequest: request }} driverId={authUser?.uid} onFeedback={(message, tone) => setMissionMessage({ message, tone })} />
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.inboxEmpty}>
                  <MaterialCommunityIcons name="email-outline" size={48} color={DESIGN_COLORS.inkMuted} />
                  <Text style={styles.inboxEmptyTitle}>Inbox empty</Text>
                  <Text style={styles.inboxEmptyText}>Rides assigned to you by dispatch will appear here.</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => setReviewOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.reviewCard, compact && styles.reviewCardCompact]}>
              <Text style={styles.reviewTitle}>Ride details</Text>
              <Text style={styles.reviewLine}>Passenger: {getPassengerName(request, assignedTransfer)}</Text>
              {request?.contactNumber ? (
                <TouchableOpacity onPress={() => startPhoneCall(request.contactNumber)} accessibilityRole="button" accessibilityLabel={`Call passenger at ${request.contactNumber}`}>
                  <Text style={styles.reviewLine}>
                    Phone: <Text style={styles.phoneLink}>{request.contactNumber}</Text>
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.reviewLine}>Phone: Not provided</Text>
              )}
              <Text style={styles.reviewLine}>Passengers: {getPassengerCountText(request)}</Text>
              <Text style={styles.reviewLine}>Assistance: {getAssistanceText(request)}</Text>
              {request?.additionalNotes ? <Text style={styles.reviewLine}>Notes: {request.additionalNotes}</Text> : null}
              <Text style={styles.reviewLine}>Request: {request?.emergencyType ?? request?.title ?? "Transport Request"}</Text>
              {request?.summary ? <Text style={styles.reviewLine}>Summary: {request.summary}</Text> : null}
              {request?.level ? <Text style={styles.reviewLine}>Priority: {request.level}</Text> : null}
              <Text style={styles.reviewLine}>When: {getWhenText(request)}</Text>
              <Text style={styles.reviewLine}>Pickup: {request?.pickupLocation ?? "Pickup location pending"}</Text>
              {request?.pickupDetails ? <Text style={styles.reviewLine}>Landmark: {request.pickupDetails}</Text> : null}
              <Text style={styles.reviewLine}>Destination: {request?.destination ?? "Nearest available response center"}</Text>
              <Text style={styles.reviewLine}>Vehicle: {getVehicleName(request, assignedTransfer)}</Text>
              <TouchableOpacity style={styles.reviewCloseButton} onPress={() => setReviewOpen(false)}>
                <Text style={styles.reviewCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Old work-hours window (driverSchedules). Nothing opens it any more: the Punch in / Punch out card */}
        {/* replaced it (driver-duty-plan.md, answer 2). Its code and saved data are kept on purpose. */}
        <Modal visible={schedulePromptOpen} transparent animationType="fade" onRequestClose={() => setSchedulePromptOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.scheduleModalCard, compact && styles.scheduleModalCardCompact]}>
              <View style={styles.scheduleModalHeader}>
                <View style={styles.scheduleModalHeaderCopy}>
                  <Text style={styles.scheduleModalTitle}>Add Availability</Text>
                  <Text style={styles.scheduleModalSubtitle}>Date: {new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text>
                </View>
                <CloseButton onPress={() => setSchedulePromptOpen(false)} label="Close work hours" />
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
                <ProfileAvatar name={displayName} backgroundColor={theme.avatarBg} color={theme.avatarText} />
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
              </View>

              <TouchableOpacity
                style={styles.logoutMenuButton}
                onPress={async () => {
                  try {
                    await logoutCurrentUser();
                    setProfileMenuOpen(false);
                    router.replace("/login");
                  } catch (error) {
                    Alert.alert("Logout failed", getAuthErrorMessage(error, "We could not log you out. Please try again."));
                  }
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
              <CloseButton onPress={() => setProfileEditorOpen(false)} label="Close profile" style={styles.closeInCorner} />

              <Text style={[styles.reviewTitle, { color: theme.text }]}>Profile</Text>
              <Text style={[styles.profileEditorSubtitle, { color: theme.mutedText }]}>Driver account details currently saved in your profile.</Text>

              <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Full Name</Text>
                <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profile?.fullName || displayName || "Not set"}</Text>
              </View>

              <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Email Address</Text>
                <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profile?.email || authUser?.email || "Not set"}</Text>
              </View>

              <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Phone Number</Text>
                <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profile?.phoneNumber || profile?.phone || "Not set"}</Text>
              </View>

              <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Barangay</Text>
                <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profile?.barangay || "Not set"}</Text>
              </View>

              <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Address</Text>
                <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profile?.address || "Not set"}</Text>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
            <View style={[styles.scheduleModalCard, compact && styles.scheduleModalCardCompact, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.scheduleModalHeader}>
                <View style={styles.scheduleModalHeaderCopy}>
                  <Text style={[styles.scheduleModalTitle, { color: theme.text }]}>History</Text>
                  <Text style={[styles.scheduleModalSubtitle, { color: theme.mutedText }]}>Your current and past driver assignments are recorded here.</Text>
                </View>
                <CloseButton onPress={() => setHistoryOpen(false)} label="Close history" />
              </View>

              <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
                {assignmentHistory.length ? (
                  assignmentHistory.map((assignment) => (
                    <View key={assignment.id} style={[styles.historyCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                      <View style={styles.historyHeader}>
                        <Text style={[styles.historyTitle, { color: theme.text }]}>{assignment.title || assignment.requestType || assignment.emergencyType || "Transport Request"}</Text>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{assignment.status || "Pending"}</Text>
                        </View>
                      </View>
                      <Text style={[styles.historyText, { color: theme.mutedText }]}>Assignment ID: {assignment.id}</Text>
                      <Text style={[styles.historyText, { color: theme.mutedText }]}>Resident: {assignment.residentName || "Not available"}</Text>
                      <Text style={[styles.historyText, { color: theme.mutedText }]}>Pickup: {assignment.pickupLocation || "Not available"}</Text>
                      <Text style={[styles.historyText, { color: theme.mutedText }]}>Destination: {assignment.destination || "Not available"}</Text>
                      <Text style={[styles.historyText, { color: theme.mutedText }]}>Vehicle: {assignment.vehicle || assignment.assignedVehicleName || "Not available"}</Text>
                      <Text style={[styles.historyText, { color: theme.mutedText }]}>Updated: {formatDateValue(assignment.updatedAt || assignment.createdAt)}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyInbox}>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No history yet</Text>
                    <Text style={[styles.emptyText, { color: theme.mutedText }]}>Your assignment history will appear here after you receive or complete transport tasks.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent navigationBarTranslucent>
          {/* The keyboard helper adds space for the keyboard; the card gets shorter and scrolls,
              so the box being typed in stays visible. Full-screen (translucent) so the space is measured correctly. */}
          <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.profileEditorCard, styles.editorCardFit, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <CloseButton onPress={() => setSettingsOpen(false)} label="Close settings" style={styles.closeInCorner} />

                <Text style={[styles.reviewTitle, { color: theme.text }]}>Settings</Text>
                <Text style={[styles.profileEditorSubtitle, { color: theme.mutedText }]}>Update your driver account details, email, and theme mode.</Text>

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={settingsForm.fullName}
                  onChangeText={(value) => setSettingsForm((current) => ({ ...current, fullName: value }))}
                  placeholder="Full name"
                  placeholderTextColor={theme.subtleText}
                />

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={settingsForm.phoneNumber}
                  onChangeText={(value) => setSettingsForm((current) => ({ ...current, phoneNumber: value }))}
                  placeholder="Phone number"
                  placeholderTextColor={theme.subtleText}
                  keyboardType="phone-pad"
                />

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Email Address</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={settingsForm.email}
                  onChangeText={(value) => setSettingsForm((current) => ({ ...current, email: value }))}
                  placeholder="Email address"
                  placeholderTextColor={theme.subtleText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
                {/* Read-only: the barangay is locked after sign-up. Only an Admin can change it. */}
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.mutedText }]}
                  value={settingsForm.barangay || "Not set"}
                  editable={false}
                />
                <Text style={[styles.profileFieldHint, { color: theme.mutedText }]}>Only an admin can change your barangay.</Text>

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Address</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={settingsForm.address}
                  onChangeText={(value) => setSettingsForm((current) => ({ ...current, address: value }))}
                  placeholder="Street or landmark"
                  placeholderTextColor={theme.subtleText}
                />

                <TouchableOpacity
                  style={[styles.secondaryActionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={() => setChangePasswordOpen(true)}
                >
                  <Text style={[styles.secondaryActionButtonText, { color: theme.text }]}>Change Password</Text>
                </TouchableOpacity>

                {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
                {profileMessage ? <Text style={styles.feedbackText}>{profileMessage}</Text> : null}

                <TouchableOpacity
                  style={[styles.primarySaveButton, savingProfile && styles.actionButtonDisabled]}
                  onPress={saveDriverSettings}
                  disabled={savingProfile}
                >
                  <Text style={styles.primarySaveButtonText}>{savingProfile ? "Saving..." : "Save Settings"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={changePasswordOpen} transparent animationType="fade" onRequestClose={() => setChangePasswordOpen(false)} statusBarTranslucent navigationBarTranslucent>
          <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.profileEditorCard, styles.editorCardFit, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <CloseButton onPress={() => setChangePasswordOpen(false)} label="Close change password" style={styles.closeInCorner} />

                <Text style={[styles.reviewTitle, { color: theme.text }]}>Change Password</Text>
                <Text style={[styles.profileEditorSubtitle, { color: theme.mutedText }]}>Enter your current password, then set a new one.</Text>

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Current Password</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={theme.subtleText}
                  secureTextEntry
                />

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>New Password</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.subtleText}
                  secureTextEntry
                />

                <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Confirm New Password</Text>
                <TextInput
                  style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={theme.subtleText}
                  secureTextEntry
                />

                {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
                {profileMessage ? <Text style={styles.feedbackText}>{profileMessage}</Text> : null}

                <TouchableOpacity
                  style={[styles.primarySaveButton, savingProfile && styles.actionButtonDisabled]}
                  onPress={saveDriverPassword}
                  disabled={savingProfile}
                >
                  <Text style={styles.primarySaveButtonText}>{savingProfile ? "Saving..." : "Update Password"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
  // One thin row on every screen: logo on the left, profile on the right (never wraps to a second row).
  header: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  // Ride Inbox (driver-home-restyle-plan.md Piece 2): a Board Tint section with card corners (24).
  assignmentPanel: { flex: 3, minWidth: 280, padding: 16, borderRadius: 24, backgroundColor: DESIGN_COLORS.boardTint },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  // Orange has dark words (DESIGN.md). Fully round: it is a small tag, not a button.
  inboxPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: DESIGN_COLORS.sakayOrange },
  inboxPillText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  assignmentStatus: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  assignmentTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  // Empty inbox card. Own styles: the History pop-up still uses emptyInbox / emptyTitle / emptyText.
  inboxEmpty: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 32, borderRadius: 24, backgroundColor: DESIGN_COLORS.paperWhite, alignItems: "center" },
  inboxEmptyTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink, textAlign: "center" },
  inboxEmptyText: { marginTop: 8, maxWidth: 360, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted, textAlign: "center" },
  assignmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "stretch" },
  leftColumn: { flex: 1, minWidth: 260, gap: 14 },
  cancelledNotice: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "#B42318", backgroundColor: "#FDE8E7" },
  cancelledNoticeCopy: { flex: 1 },
  cancelledNoticeTitle: { fontSize: 17, lineHeight: 23, fontWeight: "800", color: "#7A1A12" },
  cancelledNoticeText: { marginTop: 4, fontSize: 15, lineHeight: 21, color: "#7A1A12" },
  cancelledNoticeButton: { alignSelf: "flex-start", minHeight: 48, marginTop: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#B42318", alignItems: "center", justifyContent: "center" },
  cancelledNoticeButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  phoneLink: { fontSize: 17, fontWeight: "700", color: "#06774B", textDecorationLine: "underline" },
  mapCard: { flex: 0.82, minWidth: 280, maxWidth: 460, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEDA", overflow: "hidden" },
  mapCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E4EBE7", gap: 12, flexWrap: "wrap" },
  mapCardTitle: { fontSize: 18, fontWeight: "700", color: "#2E3C37" },
  mapHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  mapHeaderButtonText: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  mapBlankState: { minHeight: 280, aspectRatio: 1, alignItems: "stretch", justifyContent: "flex-start" },
  mapBlankTitle: { marginTop: 14, fontSize: 24, fontWeight: "800", color: "#2F3B46", textAlign: "center" },
  mapBlankText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  driverActionRow: { padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 10, borderTopWidth: 1, borderTopColor: "#E4EBE7", backgroundColor: "#FFFFFF" },
  acceptButton: { backgroundColor: "#06774B" },
  declineButton: { backgroundColor: "#C53A3A" },
  completeButton: { backgroundColor: "#FB7A2E" },
  emptyInbox: { marginTop: 20, minHeight: 300, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24, borderWidth: 1, borderColor: "#D8E2DD" },
  emptyTitle: { marginTop: 12, fontSize: 24, fontWeight: "800", color: "#2F3B46" },
  emptyText: { marginTop: 8, maxWidth: 360, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  scheduleModalCard: { width: "100%", maxWidth: 760, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E2DD", padding: 22 },
  scheduleModalCardCompact: { padding: 18 },
  scheduleModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  // flex: 1 = take the space left next to the X and wrap long text, so the X stays inside the window.
  scheduleModalHeaderCopy: { flex: 1 },
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
  logoutMenuButton: { marginTop: 14, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0B7A4A" },
  logoutMenuButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  // Settings / Change Password cards: flexShrink lets the card get shorter when the keyboard is open, and the
  // ScrollView inside (flexGrow 0 = only as tall as its content) scrolls instead.
  editorCardFit: { flexShrink: 1 },
  editorScroll: { flexGrow: 0 },
  profileEditorCard: { width: "100%", maxWidth: 520, borderRadius: 20, borderWidth: 1, padding: 22 },
  // The X at the top-right of Profile, Settings and Change Password.
  closeInCorner: { alignSelf: "flex-end" },
  profileEditorSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  profileInfoCard: { marginTop: 16, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  profileInfoLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  profileInfoValue: { marginTop: 6, fontSize: 15, lineHeight: 22, fontWeight: "700" },
  profileFieldLabel: { marginTop: 20, fontSize: 15, fontWeight: "700" },
  profileInput: { marginTop: 10, minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15, color: "#111111" },
  profileFieldHint: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  historyList: { paddingTop: 18, paddingBottom: 6, gap: 14 },
  historyCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  historyTitle: { flex: 1, minWidth: 180, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  historyText: { fontSize: 14, lineHeight: 20 },
  secondaryActionButton: { marginTop: 16, minHeight: 52, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryActionButtonText: { fontSize: 15, fontWeight: "800" },
  primarySaveButton: { marginTop: 28, minHeight: 52, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#06774B" },
  primarySaveButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  feedbackText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#335E50" },
  errorText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#B42318" },
});
