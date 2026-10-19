import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { HeaderBrand } from "../components/AppBrandHeader";
import CloseButton from "../components/ui/CloseButton";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import AdminCallSessionsSection from "../features/admin/components/AdminCallSessionsSection";
import AdminDriverApplicationsSection from "../features/admin/components/AdminDriverApplicationsSection";
import AdminDutyRecordsSection from "../features/admin/components/AdminDutyRecordsSection";
import AdminOperationsPanel from "../features/admin/components/AdminOperationsPanel";
import AdminOverviewSection from "../features/admin/components/AdminOverviewSection";
import AdminRequestsSection from "../features/admin/components/AdminRequestsSection";
import AdminResidentVerificationSection from "../features/admin/components/AdminResidentVerificationSection";
import AdminUsersSection from "../features/admin/components/AdminUsersSection";
import AdminVehiclesSection from "../features/admin/components/AdminVehiclesSection";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import { db } from "../firebase";
import useAdminCallSessions from "../features/admin/hooks/useAdminCallSessions";
import useAdminDashboardData from "../features/admin/hooks/useAdminDashboardData";
import { logAdminActivity } from "../features/admin/services/adminOperationsService";
import { getApprovalStatus, getUserName } from "../features/admin/utils/userFormatters";
import { getAssistanceText, getPassengerCountText, getPassengerName, getWhenText } from "../features/resident/utils/requestMapper";
import { COMMUNITY_PURPOSE, getPurpose, PURPOSE_OPTIONS } from "../features/resident/utils/requestOptions";
import {
  formatDateTime,
  getAverageDuration,
  getDateFromValue,
} from "../lib/dates";
import { getAuthErrorMessage, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";
import { formatPlace } from "../lib/placeText";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED, SHADOW } from "../constants/design";

// Header (padding 36 + the 54 initials button, taller than the 50 SakayNa title + line 1 = 91) + 20 above the panel
// + 28 below it, plus 1 to spare.
const ADMIN_PAGE_CHROME_HEIGHT = 140;
const CITY_VEHICLE_OWNER = "City/Barangay Vehicle";
const DRIVER_VEHICLE_OWNER = "Driver-Owned Vehicle";
const sideLinks = ["Overview", "Emergency Calls", "Resident Verification", "Driver Applications", "Duty Records", "Operations", "Requests", "Users", "Vehicles"];
// The side menu's icon for each section (Material Community Icons, outline; always shown with its word).
// The same icons as the sections' title lines.
const SIDE_LINK_ICONS = {
  Overview: "chart-bar",
  "Emergency Calls": "phone-outline",
  "Resident Verification": "account-check-outline",
  "Driver Applications": "card-account-details-outline",
  "Duty Records": "calendar-clock-outline",
  Operations: "cog-outline",
  Requests: "clipboard-list-outline",
  Users: "account-group-outline",
  Vehicles: "van-passenger",
};
const userRoleViews = ["All", "Resident", "Driver", "Dispatcher", "Admin"];
const requestStatusFilters = ["All", "Pending", "Assigned", "In Progress", "Completed", "Cancelled"];
// "Ride for" filter: the choices from the resident's request form. Old requests have no purpose, so they show under "All" only.
const requestTypeFilters = ["All", ...PURPOSE_OPTIONS];
const accountStatusOptions = ["Active", "Approved", "Pending", "Rejected", "Deactivated"];
const cityVehicleOwnerOptions = [CITY_VEHICLE_OWNER];
const ADMIN_CHANGE_REFUSED = "This change was not allowed. You can only manage non-Admin accounts in your own barangay. Check that this account belongs to your barangay.";

const normalizeRole = (role = "") => role.toLowerCase();
const getRequestTypeLabel = (request) => {
  const rawType = `${request.requestType || request.type || request.transportType || ""}`.toLowerCase();

  if (rawType.includes("community")) {
    return "Community Transport Request";
  }

  if (rawType.includes("emergency")) {
    return "Emergency Request";
  }

  if (request.emergencyType || request.level || request.priorityLevel) {
    return "Emergency Request";
  }

  return "Community Transport Request";
};

const getRequestVehicleLabel = (request) =>
  request.assignedVehicleName || request.vehicle || request.vehicleType || "Not assigned";

const getRequestPriority = (request) => request.priorityLevel || request.level || "Normal";

const getRangeStart = (rangeLabel, now) => {
  const start = new Date(now);

  if (rangeLabel === "Month") {
    start.setDate(start.getDate() - 27);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (rangeLabel === "Year") {
    start.setMonth(start.getMonth() - 11, 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return start;
};

const buildActivityBuckets = (rangeLabel, requests) => {
  const now = new Date();
  const start = getRangeStart(rangeLabel, now);

  if (rangeLabel === "Year") {
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(start);
      date.setMonth(start.getMonth() + index, 1);
      date.setHours(0, 0, 0, 0);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      return {
        key,
        label: date.toLocaleDateString("en-PH", { month: "short" }),
        start: date,
        end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
        value: 0,
      };
    });

    requests.forEach((request) => {
      const createdAt = getDateFromValue(request.createdAt);

      if (!createdAt || createdAt < start) {
        return;
      }

      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const bucket = buckets.find((item) => item.key === key);

      if (bucket) {
        bucket.value += 1;
      }
    });

    return buckets;
  }

  if (rangeLabel === "Month") {
    const buckets = Array.from({ length: 4 }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + index * 7);
      bucketStart.setHours(0, 0, 0, 0);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketStart.getDate() + 7);

      return {
        key: bucketStart.toISOString(),
        label: bucketStart.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        start: bucketStart,
        end: bucketEnd,
        value: 0,
      };
    });

    requests.forEach((request) => {
      const createdAt = getDateFromValue(request.createdAt);

      if (!createdAt || createdAt < start) {
        return;
      }

      const bucket = buckets.find((item) => createdAt >= item.start && createdAt < item.end);

      if (bucket) {
        bucket.value += 1;
      }
    });

    return buckets;
  }

  const buckets = Array.from({ length: 7 }, (_, index) => {
    const bucketDate = new Date(start);
    bucketDate.setDate(start.getDate() + index);
    bucketDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(bucketDate);
    nextDay.setDate(bucketDate.getDate() + 1);

    return {
      key: bucketDate.toISOString(),
      label: bucketDate.toLocaleDateString("en-PH", { weekday: "short" }),
      start: bucketDate,
      end: nextDay,
      value: 0,
    };
  });

  requests.forEach((request) => {
    const createdAt = getDateFromValue(request.createdAt);

    if (!createdAt || createdAt < start) {
      return;
    }

    const bucket = buckets.find((item) => createdAt >= item.start && createdAt < item.end);

    if (bucket) {
      bucket.value += 1;
    }
  });

  return buckets;
};

const getVehicleDerivedStatus = (vehicle, activeAssignments, usersById) => {
  const activeAssignment = activeAssignments.find(
    (assignment) =>
      assignment.vehicleId === vehicle.id &&
      ["Assigned", "In Progress"].includes(assignment.status)
  );

  if (activeAssignment?.status === "In Progress") {
    return "In Use";
  }

  if (activeAssignment?.status === "Assigned") {
    return "Assigned";
  }

  if ((vehicle.ownerType || CITY_VEHICLE_OWNER) === DRIVER_VEHICLE_OWNER) {
    const ownerProfile = usersById[vehicle.ownerUid];
    const isApproved = ownerProfile?.accountStatus === "Approved";
    const availability = ownerProfile?.availability || "Unavailable";

    if (!isApproved || availability !== "Available") {
      return "Inactive";
    }
  }

  return vehicle.status || "Available";
};

const emptyUserForm = {
  id: "",
  fullName: "",
  phoneNumber: "",
  barangay: "",
  address: "",
  accountStatus: "Active",
};

const emptyVehicleForm = {
  id: "",
  name: "",
  type: "",
  plateNumber: "",
  ownerType: CITY_VEHICLE_OWNER,
};

export default function AdminHome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compact = width < 1080;
  const narrow = width < 560;
  const adminPanelHeight = useMemo(() => {
    if (compact) {
      return null;
    }

    // The window minus the header (91), the space above the panel (20) and below it (28), so the page itself never
    // scrolls and Overview can fill the panel on one screen. Under 420 the page scrolls instead, as before.
    return Math.max(420, height - ADMIN_PAGE_CHROME_HEIGHT);
  }, [compact, height]);
  const { authUser, displayName, profile, profileStatus } = useCurrentUserProfile();
  const { theme } = useTheme();

  const initials = useMemo(() => {
    const words = displayName.split(" ").filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "A";
  }, [displayName]);

  const adminAccessStatus = useMemo(() => {
    if (profileStatus === "idle" || profileStatus === "loading") {
      return "checking";
    }

    if (profileStatus === "ready" && profile?.role === "Admin" && profile?.accountStatus === "Active") {
      return "authorized";
    }

    return "unauthorized";
  }, [profile, profileStatus]);

  useEffect(() => {
    if (adminAccessStatus === "unauthorized") {
      router.replace("/login");
    }
  }, [adminAccessStatus, router]);

  const [selectedSection, setSelectedSection] = useState("Overview");
  const [rangeLabel, setRangeLabel] = useState("Week");
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const [requestTypeFilter, setRequestTypeFilter] = useState("All");
  const [userRoleView, setUserRoleView] = useState("All");

  // Resident Verification and Driver Applications: only this Admin's own barangay.
  // The barangay is set on the Admin's profile in the Firebase Console.
  const adminBarangay = profile?.barangay || "";

  const {
    users,
    driverApplications,
    transportRequests,
    vehicles,
    driverAssignments,
    isLoadingUsers,
    isLoadingRequests,
    isLoadingVehicles,
    isLoadingApplications,
    usersError,
    setUsersError,
    requestsError,
    applicationsError,
    vehiclesError,
    setVehiclesError,
    usersAtLimit,
    requestsAtLimit,
    vehiclesAtLimit,
    collectionLimit,
    counts,
  } = useAdminDashboardData(adminAccessStatus === "authorized", adminBarangay);

  const { callSessions, staleRingingCount, isLoadingCallSessions, callSessionsError } = useAdminCallSessions(
    adminAccessStatus === "authorized"
  );

  // Resident Verification: only the Pending residents of this Admin's own barangay.
  const [residentVerifications, setResidentVerifications] = useState([]);
  const [isLoadingVerifications, setIsLoadingVerifications] = useState(false);
  const [verificationsError, setVerificationsError] = useState("");

  useEffect(() => {
    if (adminAccessStatus !== "authorized" || !adminBarangay) {
      setResidentVerifications([]);
      return undefined;
    }

    setIsLoadingVerifications(true);
    const unsubscribe = onSnapshot(
      query(collection(db, "residentVerifications"), where("barangay", "==", adminBarangay)),
      (snapshot) => {
        const pending = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => item.status === "Pending")
          // Oldest first, so nobody waits too long.
          .sort((a, b) => (a.submittedAt?.toMillis?.() ?? 0) - (b.submittedAt?.toMillis?.() ?? 0));
        setResidentVerifications(pending);
        setVerificationsError("");
        setIsLoadingVerifications(false);
      },
      (error) => {
        console.log("Resident verifications listener warning:", error);
        setVerificationsError("Resident verifications could not be loaded. Please check Firestore permissions.");
        setIsLoadingVerifications(false);
      }
    );

    return unsubscribe;
  }, [adminAccessStatus, adminBarangay]);

  const [userMessage, setUserMessage] = useState("");
  const [vehicleMessage, setVehicleMessage] = useState("");

  const [selectedRequestRecord, setSelectedRequestRecord] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [confirmingUserDelete, setConfirmingUserDelete] = useState(null);

  const [vehicleEditorOpen, setVehicleEditorOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [confirmingVehicleDelete, setConfirmingVehicleDelete] = useState(null);

  const usersById = useMemo(
    () =>
      users.reduce((accumulator, user) => {
        accumulator[user.id] = user;
        return accumulator;
      }, {}),
    [users]
  );

  // Accounts the person deleted (Task 3.15). They never show up for approval (their application or
  // proof of residency may still say "Pending"). Both lists use the account's id as their own id.
  const deletedUserIds = useMemo(() => new Set(users.filter((user) => user.deletedAt).map((user) => user.id)), [users]);
  const pendingApplications = useMemo(
    () => driverApplications.filter((application) => application.status === "Pending" && !deletedUserIds.has(application.id)),
    [deletedUserIds, driverApplications]
  );
  const pendingVerifications = useMemo(
    () => residentVerifications.filter((verification) => !deletedUserIds.has(verification.id)),
    [deletedUserIds, residentVerifications]
  );

  const dispatcherAccounts = useMemo(
    () => users.filter((user) => normalizeRole(user.role) === "dispatcher"),
    [users]
  );

  const activeAssignments = useMemo(
    () => driverAssignments.filter((assignment) => ["Assigned", "In Progress"].includes(assignment.status)),
    [driverAssignments]
  );

  const requestsWithDerivedFields = useMemo(
    () =>
      transportRequests.map((request) => ({
        ...request,
        requestTypeLabel: getRequestTypeLabel(request),
        vehicleLabel: getRequestVehicleLabel(request),
        priorityLabel: getRequestPriority(request),
      })),
    [transportRequests]
  );

  const filteredRequests = useMemo(() => {
    return requestsWithDerivedFields.filter((request) => {
      const requestStatus = request.status || "Pending";
      const matchesStatus = requestStatusFilter === "All" || requestStatus === requestStatusFilter;
      const matchesType = requestTypeFilter === "All" || getPurpose(request) === requestTypeFilter;

      return matchesStatus && matchesType;
    });
  }, [requestStatusFilter, requestTypeFilter, requestsWithDerivedFields]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const role = user.role || "";
      return userRoleView === "All" || role === userRoleView;
    });
  }, [userRoleView, users]);

  const vehiclesWithDerivedStatus = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        ...vehicle,
        derivedStatus: getVehicleDerivedStatus(vehicle, activeAssignments, usersById),
      })),
    [activeAssignments, usersById, vehicles]
  );

  const filteredVehicles = vehiclesWithDerivedStatus;

  // How many loaded requests have this "ride for" choice (used until the server counts load).
  // getPurpose counts the old name "Community / Personal Trip" as "Community Activity".
  const countRequestsByPurpose = (purpose) => requestsWithDerivedFields.filter((request) => getPurpose(request) === purpose).length;

  const activeRequestsCount = useMemo(
    () =>
      requestsWithDerivedFields.filter((request) => !["Completed", "Cancelled"].includes(request.status || "Pending")).length,
    [requestsWithDerivedFields]
  );

  const completedRequestsCount = useMemo(
    () => requestsWithDerivedFields.filter((request) => request.status === "Completed").length,
    [requestsWithDerivedFields]
  );

  const cancelledRequestsCount = useMemo(
    () => requestsWithDerivedFields.filter((request) => request.status === "Cancelled").length,
    [requestsWithDerivedFields]
  );

  const totalRegisteredDrivers = useMemo(
    () => users.filter((user) => normalizeRole(user.role) === "driver").length,
    [users]
  );

  const availableDrivers = useMemo(
    () =>
      users.filter(
        (user) =>
          normalizeRole(user.role) === "driver" &&
          user.accountStatus === "Approved" &&
          user.availability === "Available"
      ).length,
    [users]
  );

  const averageDispatchTime = useMemo(
    () => getAverageDuration(requestsWithDerivedFields, ["assignedAt"]),
    [requestsWithDerivedFields]
  );

  const averageResponseTime = useMemo(
    () => getAverageDuration(requestsWithDerivedFields, ["acceptedAt", "completedAt"]),
    [requestsWithDerivedFields]
  );

  // Totals prefer the server-side count; the client tally is the fallback until it loads.
  const overviewNumbers = {
    medical: counts.medicalRequests ?? countRequestsByPurpose("Medical / Health"),
    community: counts.communityRequests ?? countRequestsByPurpose(COMMUNITY_PURPOSE),
    other: counts.otherRequests ?? countRequestsByPurpose("Other"),
    active: counts.activeRequests ?? activeRequestsCount,
    completed: counts.completedRequests ?? completedRequestsCount,
    cancelled: counts.cancelledRequests ?? cancelledRequestsCount,
    drivers: counts.registeredDrivers ?? totalRegisteredDrivers,
    availableDrivers: counts.availableDrivers ?? availableDrivers,
    vehicles: counts.registeredVehicles ?? vehicles.length,
  };

  // The split of the active requests (Overview shows it under "Active").
  const requestStatusStats = ["Pending", "Assigned", "In Progress"]
    .map((status) => ({
      label: status,
      value: requestsWithDerivedFields.filter((request) => (request.status || "Pending") === status).length,
    }));

  const activityBuckets = useMemo(
    () => buildActivityBuckets(rangeLabel, requestsWithDerivedFields),
    [rangeLabel, requestsWithDerivedFields]
  );

  const menuItems = [
    {
      key: "profile",
      label: "Profile",
      icon: "user",
      action: () => {
        setProfileMenuOpen(false);
        setProfileEditorOpen(true);
      },
    },
    { key: "history", label: "History", icon: "clock-o", action: () => {} },
    { key: "settings", label: "Settings", icon: "cog", action: () => {} },
  ];

  const clearSectionMessages = () => {
    setUserMessage("");
    setVehicleMessage("");
  };

  // Match the saved barangay exactly; a different spelling is view only.
  const canManageUser = (user) => Boolean(
    profile?.role === "Admin"
    && user?.id
    && user.id !== authUser?.uid
    && user.role !== "Admin"
    && typeof user.barangay === "string"
    && user.barangay !== ""
    && user.barangay === adminBarangay
  );

  const openUserEditor = (user) => {
    clearSectionMessages();
    if (!canManageUser(user)) {
      setUsersError(ADMIN_CHANGE_REFUSED);
      return;
    }
    setUsersError("");
    setEditingUser(user);
    setUserForm({
      id: user.id,
      fullName: getUserName(user),
      phoneNumber: user.phoneNumber || user.phone || "",
      barangay: user.barangay || "",
      address: user.address || "",
      accountStatus: getApprovalStatus(user),
    });
  };

  const saveUserChanges = async () => {
    if (!editingUser?.id) {
      return;
    }
    if (!canManageUser(users.find((user) => user.id === editingUser.id))) {
      setUsersError(ADMIN_CHANGE_REFUSED);
      return;
    }

    setSavingUser(true);
    setUsersError("");
    setUserMessage("");

    try {
      const nextValues = {
        phoneNumber: userForm.phoneNumber.trim(),
        phone: userForm.phoneNumber.trim(),
        address: userForm.address.trim(),
      };
      const changedFields = Object.keys(nextValues).filter((field) => nextValues[field] !== (editingUser[field] || ""));

      await updateDoc(doc(db, "users", editingUser.id), {
        ...nextValues,
        updatedAt: serverTimestamp(),
      });

      if (changedFields.length) {
        logAdminActivity({
          adminId: authUser?.uid || "",
          action: "user-profile-updated",
          targetType: "user",
          targetId: editingUser.id,
          summary: `${getUserName(editingUser)} profile details updated.`,
          metadata: { fields: changedFields },
        }).catch((error) => console.log("Activity log warning:", error));
      }

      setUserMessage("User account updated successfully.");
      setEditingUser(null);
      setUserForm(emptyUserForm);
    } catch (error) {
      console.log("User update failed:", error);
      setUsersError(error?.code === "permission-denied" ? ADMIN_CHANGE_REFUSED : "User account could not be updated. Please try again.");
    } finally {
      setSavingUser(false);
    }
  };

  const deleteUserRecord = async (user) => {
    if (!user?.id) {
      return;
    }

    setConfirmingUserDelete(null);
    setUsersError("Direct profile deletion is disabled because it can orphan Firebase Authentication accounts. Use Operations to create a pending backend deletion request.");
  };

  const openVehicleEditor = (vehicle = null) => {
    clearSectionMessages();
    setVehicleForm(
      vehicle
        ? {
            id: vehicle.id,
            name: vehicle.name || "",
            type: vehicle.type || "",
            plateNumber: vehicle.plateNumber || "",
            ownerType: vehicle.ownerType || CITY_VEHICLE_OWNER,
          }
        : emptyVehicleForm
    );
    setVehicleEditorOpen(true);
  };

  const saveVehicle = async () => {
    if (!vehicleForm.name.trim() || !vehicleForm.type.trim()) {
      setVehiclesError("Vehicle name and type are required.");
      return;
    }

    setSavingVehicle(true);
    setVehiclesError("");
    setVehicleMessage("");

    try {
      const vehicleId = vehicleForm.id || `vehicle-${Date.now()}`;
      const payload = {
        name: vehicleForm.name.trim(),
        type: vehicleForm.type.trim(),
        plateNumber: vehicleForm.plateNumber.trim().toUpperCase(),
        ownerType: vehicleForm.ownerType,
        updatedAt: serverTimestamp(),
      };

      // Vans are not tied to one driver: the dispatcher picks the van for each ride.
      // The status is set by the app itself (Assigned when a ride is given, Available when it ends,
      // Archived when deleted), so it is only set once here, for a new vehicle. Editing leaves it alone.
      if (!vehicleForm.id) {
        payload.createdAt = serverTimestamp();
        payload.status = "Available";
      }

      await setDoc(doc(db, "vehicles", vehicleId), payload, { merge: true });

      logAdminActivity({
        adminId: authUser?.uid || "",
        action: vehicleForm.id ? "vehicle-updated" : "vehicle-created",
        targetType: "vehicle",
        targetId: vehicleId,
        summary: `${payload.name} was ${vehicleForm.id ? "updated" : "created"}.`,
        metadata: { plateNumber: payload.plateNumber, ownerType: payload.ownerType },
      }).catch((error) => console.log("Activity log warning:", error));

      setVehicleMessage(vehicleForm.id ? "Vehicle updated successfully." : "Vehicle added successfully.");
      setVehicleEditorOpen(false);
      setVehicleForm(emptyVehicleForm);
    } catch (error) {
      console.log("Vehicle save failed:", error);
      setVehiclesError("Vehicle details could not be saved. Please check Firestore permissions.");
    } finally {
      setSavingVehicle(false);
    }
  };

  const deleteVehicleRecord = async (vehicle) => {
    if (!vehicle?.id) {
      return;
    }

    setSavingVehicle(true);
    setVehiclesError("");
    setVehicleMessage("");

    try {
      await updateDoc(doc(db, "vehicles", vehicle.id), {
        status: "Archived",
        archivedAt: serverTimestamp(),
        archivedBy: authUser?.uid || "",
        updatedAt: serverTimestamp(),
      });
      logAdminActivity({
        adminId: authUser?.uid || "",
        action: "vehicle-archived",
        targetType: "vehicle",
        targetId: vehicle.id,
        summary: `${vehicle.name || "Vehicle"} was archived.`,
        metadata: { plateNumber: vehicle.plateNumber || "" },
      }).catch((error) => console.log("Activity log warning:", error));

      setVehicleMessage(`${vehicle.name || "Vehicle"} was archived. Historical assignments were preserved.`);
      setConfirmingVehicleDelete(null);
    } catch (error) {
      console.log("Vehicle archive failed:", error);
      setVehiclesError("The vehicle could not be archived. Please check Firestore permissions.");
    } finally {
      setSavingVehicle(false);
    }
  };

  const renderSectionContent = () => {
    if (selectedSection === "Emergency Calls") {
      return (
        <AdminCallSessionsSection
          theme={theme}
          callSessions={callSessions}
          isLoadingCallSessions={isLoadingCallSessions}
          callSessionsError={callSessionsError}
        />
      );
    }

    if (selectedSection === "Resident Verification") {
      return (
        <AdminResidentVerificationSection
          theme={theme}
          adminId={authUser?.uid || ""}
          adminBarangay={adminBarangay}
          verifications={pendingVerifications}
          isLoading={isLoadingVerifications}
          loadError={verificationsError}
        />
      );
    }

    if (selectedSection === "Driver Applications") {
      return (
        <AdminDriverApplicationsSection
          theme={theme}
          adminId={authUser?.uid || ""}
          adminBarangay={adminBarangay}
          applications={pendingApplications}
          isLoading={isLoadingApplications}
          loadError={applicationsError}
        />
      );
    }

    // Daily DTR of the drivers (driver-duty-plan.md Step 6).
    if (selectedSection === "Duty Records") {
      return <AdminDutyRecordsSection />;
    }

    if (selectedSection === "Operations") {
      return <AdminOperationsPanel users={users} vehicles={vehiclesWithDerivedStatus} assignments={driverAssignments} requests={requestsWithDerivedFields} requestsLoading={isLoadingRequests} adminId={authUser?.uid || ""} adminName={displayName} adminBarangay={adminBarangay} canManageUser={canManageUser} theme={theme} />;
    }

    if (selectedSection === "Requests") {
      return (
        <AdminRequestsSection
          requests={requestsWithDerivedFields}
          requestTypeFilters={requestTypeFilters}
          requestTypeFilter={requestTypeFilter}
          setRequestTypeFilter={setRequestTypeFilter}
          requestStatusFilters={requestStatusFilters}
          requestStatusFilter={requestStatusFilter}
          setRequestStatusFilter={setRequestStatusFilter}
          isLoadingRequests={isLoadingRequests}
          filteredRequests={filteredRequests}
          requestsError={requestsError}
          setSelectedRequestRecord={setSelectedRequestRecord}
          atLimit={requestsAtLimit}
          collectionLimit={collectionLimit}
        />
      );
    }

    if (selectedSection === "Users") {
      return (
        <AdminUsersSection
          users={users}
          userRoleViews={userRoleViews}
          userRoleView={userRoleView}
          setUserRoleView={setUserRoleView}
          isLoadingUsers={isLoadingUsers}
          filteredUsers={filteredUsers}
          usersError={usersError}
          userMessage={userMessage}
          openUserEditor={openUserEditor}
          canManageUser={canManageUser}
          setSelectedSection={setSelectedSection}
          atLimit={usersAtLimit}
          collectionLimit={collectionLimit}
        />
      );
    }

    if (selectedSection === "Vehicles") {
      return (
        <AdminVehiclesSection
          theme={theme}
          styles={styles}
          cityVehicleOwnerLabel={CITY_VEHICLE_OWNER}
          isLoadingVehicles={isLoadingVehicles}
          filteredVehicles={filteredVehicles}
          vehiclesError={vehiclesError}
          vehicleMessage={vehicleMessage}
          openVehicleEditor={openVehicleEditor}
          setConfirmingVehicleDelete={setConfirmingVehicleDelete}
          atLimit={vehiclesAtLimit}
          collectionLimit={collectionLimit}
        />
      );
    }

    return (
      <AdminOverviewSection
        // Until users, requests, vehicles and applications have all answered, Overview shows grey placeholders, not 0s.
        loading={isLoadingUsers || isLoadingRequests || isLoadingVehicles || isLoadingApplications}
        numbers={overviewNumbers}
        pendingApplicationsCount={pendingApplications.length}
        dispatcherCount={dispatcherAccounts.length}
        averageDispatchTime={averageDispatchTime}
        averageResponseTime={averageResponseTime}
        rangeLabel={rangeLabel}
        setRangeLabel={setRangeLabel}
        activityBuckets={activityBuckets}
        requestStatusStats={requestStatusStats}
        atLimit={requestsAtLimit}
        collectionLimit={collectionLimit}
      />
    );
  };

  if (adminAccessStatus !== "authorized") {
    return (
      <View style={[styles.accessPage, { backgroundColor: theme.page }]}>
        <ActivityIndicator color="#0B8E59" />
        <Text style={[styles.accessText, { color: theme.mutedText }]}>Checking admin access...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.page, { backgroundColor: theme.page }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
          {/* The same title as the dispatcher website: icon, "SakayNa", and the barangay name under it (AppBrandHeader.jsx). */}
          <HeaderBrand barangay={adminBarangay} compact={width < 900} />

          <View style={[styles.headerRight, narrow && styles.headerRightCompact]}>
            <TouchableOpacity style={[styles.profileTrigger, { backgroundColor: theme.headerBg }]} onPress={() => setProfileMenuOpen(true)}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.avatarBg }]}>
                <Text style={[styles.avatarText, { color: theme.avatarText }]}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.container, compact && styles.containerCompact]}>
          <View style={[styles.layoutRow, compact && styles.layoutRowCompact, !compact && { minHeight: adminPanelHeight }]}>
            <View
              style={[
                styles.sidebar,
                compact && styles.sidebarCompact,
                !compact && { height: adminPanelHeight },
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.sidebarTitle, { color: theme.text }]}>Admin Tools</Text>

              {/* Wide windows: one row per section. Narrow windows (compact): the same items as a row of pills that wraps. */}
              <ScrollView style={styles.panelScrollArea} contentContainerStyle={[styles.panelScrollContent, compact && styles.panelScrollContentCompact]} showsVerticalScrollIndicator={false}>
                {sideLinks.map((label) => {
                  const active = selectedSection === label;

                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.sideBlock, active && styles.sideBlockActive]}
                      onPress={() => setSelectedSection(label)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={styles.sideBlockRow}>
                        <MaterialCommunityIcons name={SIDE_LINK_ICONS[label]} size={24} color={active ? NEUTRAL[0] : NEUTRAL[900]} />
                        <Text style={[styles.sideBlockText, active && styles.sideBlockTextActive]}>{label}</Text>
                        {/* Count badges (DESIGN.md Style): pills. Red only for the emergency count; the "waiting for you"
                            counts are Sakay Orange with dark words (never white words on orange). */}
                        {label === "Emergency Calls" && staleRingingCount > 0 ? (
                          <View style={[styles.countBadge, styles.countBadgeRed]}>
                            <Text style={[styles.countBadgeText, styles.countBadgeTextRed]}>{staleRingingCount}</Text>
                          </View>
                        ) : null}
                        {label === "Resident Verification" && pendingVerifications.length > 0 ? (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{pendingVerifications.length}</Text>
                          </View>
                        ) : null}
                        {label === "Driver Applications" && pendingApplications.length > 0 ? (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{pendingApplications.length}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={[styles.mainArea, !compact && { height: adminPanelHeight }]}>
              <ScrollView
                style={[styles.contentPanel, !compact && styles.contentPanelFixed, { backgroundColor: theme.surface, borderColor: theme.border }]}
                contentContainerStyle={styles.contentPanelScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {renderSectionContent()}
              </ScrollView>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedRequestRecord)} transparent animationType="fade" onRequestClose={() => setSelectedRequestRecord(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <ScrollView style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedRequestRecord?.id || "Request Details"}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>{selectedRequestRecord?.status || "Pending"} request record.</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedRequestRecord(null)}>
                <FontAwesome name="close" size={20} color={NEUTRAL[900]} />
              </TouchableOpacity>
            </View>

            <View style={[styles.detailBox, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.detailLine, { color: theme.text }]}>Resident: {selectedRequestRecord?.residentName || "Resident"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Ride for: {selectedRequestRecord?.title || selectedRequestRecord?.emergencyType || "Not specified"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>When: {getWhenText(selectedRequestRecord)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Passenger: {getPassengerName(selectedRequestRecord)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Contact Number: {selectedRequestRecord?.contactNumber || "Not provided"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>People Riding: {getPassengerCountText(selectedRequestRecord)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Pickup: {formatPlace(selectedRequestRecord?.pickupLocation) || selectedRequestRecord?.barangay || "Not available"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Landmark: {selectedRequestRecord?.pickupDetails || "Not provided"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Destination: {selectedRequestRecord?.destination || "Not available"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Help Needed: {getAssistanceText(selectedRequestRecord)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Assigned Driver: {selectedRequestRecord?.assignedDriverName || "Unassigned"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Vehicle: {selectedRequestRecord?.vehicleLabel || "Not assigned"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Priority: {selectedRequestRecord?.priorityLabel || "Normal"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Status: {selectedRequestRecord?.status || "Pending"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Date Submitted: {formatDateTime(selectedRequestRecord?.createdAt)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Date Assigned: {formatDateTime(selectedRequestRecord?.assignedAt)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Date Accepted: {formatDateTime(selectedRequestRecord?.acceptedAt)}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Date Completed: {formatDateTime(selectedRequestRecord?.completedAt)}</Text>
              {selectedRequestRecord?.additionalNotes ? <Text style={[styles.detailLine, { color: theme.text }]}>Notes: {selectedRequestRecord.additionalNotes}</Text> : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={Boolean(editingUser)} transparent animationType="fade" onRequestClose={() => setEditingUser(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.profileEditorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <CloseButton onPress={() => setEditingUser(null)} label="Close edit account" style={styles.closeInCorner} />

            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Account</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Update phone and address. Barangay is read only. Account status is managed in Operations.
            </Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: NEUTRAL[100], borderColor: NEUTRAL[200], color: NEUTRAL[700] }]}
              value={userForm.fullName}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500], color: theme.text }]}
              placeholder="Phone number"
              placeholderTextColor={theme.subtleText}
              value={userForm.phoneNumber}
              onChangeText={(value) => setUserForm((current) => ({ ...current, phoneNumber: value }))}
              keyboardType="phone-pad"
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: NEUTRAL[100], borderColor: NEUTRAL[200], color: NEUTRAL[700] }]}
              placeholder="Barangay"
              placeholderTextColor={theme.subtleText}
              value={userForm.barangay}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Address</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500], color: theme.text }]}
              placeholder="Address"
              placeholderTextColor={theme.subtleText}
              value={userForm.address}
              onChangeText={(value) => setUserForm((current) => ({ ...current, address: value }))}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Account Status (managed in Operations)</Text>
            <View style={styles.filterRow}>
              {accountStatusOptions.map((status) => {
                const active = userForm.accountStatus === status;

                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      { borderColor: active ? GREEN[600] : theme.border, backgroundColor: active ? GREEN[600] : theme.surface },
                    ]}
                    disabled
                  >
                    <Text style={[styles.filterChipText, { color: active ? NEUTRAL[0] : theme.text }]}>{status}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FeedbackMessage message={usersError} tone="error" />
            <TouchableOpacity style={[styles.primarySaveButton, savingUser && styles.actionButtonDisabled]} onPress={saveUserChanges} disabled={savingUser}>
              <Text style={styles.primarySaveButtonText}>{savingUser ? "Saving..." : "Save Changes"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={vehicleEditorOpen} transparent animationType="fade" onRequestClose={() => setVehicleEditorOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.profileEditorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <CloseButton onPress={() => setVehicleEditorOpen(false)} label="Close vehicle editor" style={styles.closeInCorner} />

            <Text style={[styles.modalTitle, { color: theme.text }]}>{vehicleForm.id ? "Edit Vehicle" : "Add Vehicle"}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Vehicle records are stored in the `vehicles` collection and used by dispatch and admin monitoring.</Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Name</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500], color: theme.text }]}
              placeholder="Vehicle name"
              placeholderTextColor={theme.subtleText}
              value={vehicleForm.name}
              onChangeText={(value) => setVehicleForm((current) => ({ ...current, name: value }))}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Type</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500], color: theme.text }]}
              placeholder="Ambulance, Van, SUV..."
              placeholderTextColor={theme.subtleText}
              value={vehicleForm.type}
              onChangeText={(value) => setVehicleForm((current) => ({ ...current, type: value }))}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Plate Number</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500], color: theme.text }]}
              placeholder="Plate number"
              placeholderTextColor={theme.subtleText}
              value={vehicleForm.plateNumber}
              onChangeText={(value) => setVehicleForm((current) => ({ ...current, plateNumber: value.toUpperCase() }))}
              autoCapitalize="characters"
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Owner Type</Text>
            <View style={styles.filterRow}>
              {(vehicleForm.ownerType === DRIVER_VEHICLE_OWNER ? [DRIVER_VEHICLE_OWNER] : cityVehicleOwnerOptions).map((ownerType) => {
                const active = vehicleForm.ownerType === ownerType;

                return (
                  <TouchableOpacity
                    key={ownerType}
                    style={[
                      styles.filterChip,
                      { borderColor: active ? GREEN[600] : theme.border, backgroundColor: active ? GREEN[600] : theme.surface },
                    ]}
                    onPress={() => setVehicleForm((current) => ({ ...current, ownerType }))}
                  >
                    <Text style={[styles.filterChipText, { color: active ? NEUTRAL[0] : theme.text }]}>{ownerType}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.primarySaveButton, savingVehicle && styles.actionButtonDisabled]} onPress={saveVehicle} disabled={savingVehicle}>
              <Text style={styles.primarySaveButtonText}>{savingVehicle ? "Saving..." : vehicleForm.id ? "Save Vehicle" : "Add Vehicle"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(confirmingUserDelete)} transparent animationType="fade" onRequestClose={() => setConfirmingUserDelete(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.confirmCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Deletion Request</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Direct deletion is disabled because it can orphan Firebase Authentication accounts. Use Operations to create a pending Phase 8 backend deletion request for {confirmingUserDelete ? getUserName(confirmingUserDelete) : "this user"}.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.secondaryActionButton, styles.confirmButton]} onPress={() => setConfirmingUserDelete(null)}>
                <Text style={styles.secondaryActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryActionButton, styles.confirmButton, savingUser && styles.actionButtonDisabled]} onPress={() => deleteUserRecord(confirmingUserDelete)} disabled={savingUser}>
                <Text style={styles.primaryActionButtonText}>{savingUser ? "Checking..." : "Deletion unavailable"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(confirmingVehicleDelete)} transparent animationType="fade" onRequestClose={() => setConfirmingVehicleDelete(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.confirmCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Archive Vehicle</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Archive {confirmingVehicleDelete?.name || "this vehicle"}? Historical records will be preserved.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.secondaryActionButton, styles.confirmButton]} onPress={() => setConfirmingVehicleDelete(null)}>
                <Text style={styles.secondaryActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryActionButton, styles.confirmButton, savingVehicle && styles.actionButtonDisabled]} onPress={() => deleteVehicleRecord(confirmingVehicleDelete)} disabled={savingVehicle}>
                <Text style={styles.primaryActionButtonText}>{savingVehicle ? "Archiving..." : "Archive Vehicle"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => setProfileMenuOpen(false)}>
        <Pressable style={[styles.menuOverlay, { backgroundColor: theme.menuOverlay }]} onPress={() => setProfileMenuOpen(false)}>
          <Pressable style={[styles.profileMenuCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]} onPress={() => {}}>
            <View style={[styles.profileMenuHeader, { borderBottomColor: theme.border }]}>
              <ProfileAvatar name={displayName} backgroundColor={theme.avatarBg} color={theme.avatarText} />
              <Text style={[styles.profileMenuName, { color: theme.text }]}>{displayName}</Text>
              <Text style={[styles.profileMenuEmail, { color: theme.secondaryText }]}>{profile?.email || authUser?.email || "Admin account"}</Text>
            </View>

            <View style={styles.profileMenuBody}>
              {menuItems.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.menuItem, item.key !== "profile" && styles.menuItemDisabled]} onPress={item.key === "profile" ? item.action : undefined} disabled={item.key !== "profile"} accessibilityRole="button" accessibilityState={{ disabled: item.key !== "profile" }}>
                  <View style={styles.menuItemLeft}>
                    <FontAwesome name={item.icon} size={18} color={theme.mutedText} />
                    <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                  </View>
                  {item.key === "profile" ? null : <Text style={[styles.menuItemSoon, { color: theme.secondaryText }]}>Upcoming</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.logoutMenuButton}
              onPress={async () => {
                try {
                  // Go to Log In first, then sign out. Signing out first makes AuthRouteGate take the screens
                  // away, and then the move to Log In has nothing to run in ("REPLACE ... not handled").
                  setProfileMenuOpen(false);
                  router.replace("/login");
                  await logoutCurrentUser();
                } catch (error) {
                  const message = getAuthErrorMessage(error, "We could not log you out. Please try again.");
                  if (Platform.OS === "web") {
                    if (typeof window !== "undefined") {
                      window.alert(`Logout failed\n\n${message}`);
                    }
                  } else {
                    Alert.alert("Logout failed", message);
                  }
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

            <Text style={[styles.modalTitle, { color: theme.text }]}>Profile</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>This profile sheet remains view-only for the admin session.</Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: NEUTRAL[100], borderColor: NEUTRAL[200], color: NEUTRAL[700] }]}
              value={profile?.fullName || displayName}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: NEUTRAL[100], borderColor: NEUTRAL[200], color: NEUTRAL[700] }]}
              value={profile?.phoneNumber || ""}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: NEUTRAL[100], borderColor: NEUTRAL[200], color: NEUTRAL[700] }]}
              value={profile?.barangay || "Not set (set it in the Firebase Console)"}
              editable={false}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(previewImageUrl)} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl("")}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalCloseArea} onPress={() => setPreviewImageUrl("")}>
            <Image source={{ uri: previewImageUrl }} style={styles.imageModalPreview} resizeMode="contain" />
            <Text style={styles.imageModalCloseText}>Tap anywhere to close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// UI refresh (DESIGN.md "Style"): the corners, colors, shadows, font weights and button shapes follow the Style.
// Text is at least 15. How dense the Admin website is: DESIGN.md "Admin website exception" (Task 3.19).
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NEUTRAL[50] },
  accessPage: { flex: 1, backgroundColor: NEUTRAL[50], alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  accessText: { fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[700], textAlign: "center" },
  content: { paddingBottom: 28 },
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
    borderRadius: CORNER.pill,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: CORNER.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontFamily: FONT.bold,
  },
  container: { width: "100%", alignSelf: "stretch", paddingHorizontal: 22, paddingTop: 20 },
  containerCompact: { paddingHorizontal: 12, paddingTop: 14 },
  layoutRow: { width: "100%", flexDirection: "row", flexWrap: "nowrap", gap: 18, alignItems: "stretch" },
  layoutRowCompact: { flexWrap: "wrap" },
  // The side menu and the content panel: white cards (16 corners, thin edge from the theme, Level 1 shadow).
  sidebar: {
    width: 228,
    flexShrink: 0,
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: CORNER.card,
    alignSelf: "stretch",
    ...SHADOW.level1,
  },
  sidebarCompact: {
    width: "100%",
    alignSelf: "stretch",
  },
  sidebarTitle: { fontSize: 20, fontFamily: FONT.bold, paddingHorizontal: 4 },
  sidebarSubtitle: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 22, marginBottom: 6 },
  panelScrollArea: { flex: 1 },
  panelScrollContent: { gap: 4, paddingBottom: 2 },
  // Narrow windows: the menu items side by side, wrapping onto more lines.
  panelScrollContentCompact: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // One section in the side menu (DESIGN.md "Admin website exception"): an icon and its word, left aligned, at least
  // 48 tall. The open one is a green pill with white words; the others have no fill.
  sideBlock: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: CORNER.pill,
    justifyContent: "center",
  },
  sideBlockRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sideBlockActive: { backgroundColor: GREEN[600] },
  // flexGrow (not flex: 1), so the word keeps its width inside a narrow-window pill and pushes the badge to the end.
  sideBlockText: { flexGrow: 1, flexShrink: 1, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  sideBlockTextActive: { color: NEUTRAL[0] },
  // The numbers next to a section name (count badges, DESIGN.md Style): pills.
  countBadge: { minWidth: 24, height: 24, paddingHorizontal: 6, marginLeft: 8, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: ORANGE[500] },
  countBadgeRed: { backgroundColor: RED[600] },
  countBadgeText: { fontSize: 15, fontFamily: FONT.bold, color: NEUTRAL[900] },
  countBadgeTextRed: { color: NEUTRAL[0] },
  mainArea: { flex: 1, minWidth: 0, gap: 12 },
  contentPanel: { padding: 14, borderRadius: CORNER.card, borderWidth: 1, ...SHADOW.level1 },
  contentPanelFixed: { flex: 1, minHeight: 0 },
  // flexGrow: Overview's one-screen dashboard can fill the whole panel; other sections are just as tall as their content.
  contentPanelScrollContent: { flexGrow: 1, paddingBottom: 2 },
  verificationSection: { marginTop: 14 },
  subsectionTitle: { fontSize: 18, fontFamily: FONT.bold },
  verificationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 14 },
  verificationCard: { flexGrow: 1, flexBasis: 300, padding: 18, borderRadius: CORNER.card, borderWidth: 1 },
  verificationTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  verifyIdentity: { flexDirection: "row", gap: 12, flex: 1, minWidth: 0 },
  verifyAvatar: { width: 48, height: 48, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center" },
  verifyIdentityCopy: { flex: 1 },
  verifyName: { fontSize: 20, fontFamily: FONT.bold },
  verifyMeta: { marginTop: 4, fontSize: 15, fontFamily: FONT.semiBold },
  verifyDetail: { fontFamily: FONT.regular, marginTop: 10, fontSize: 15, lineHeight: 22 },
  pendingPill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: CORNER.pill, backgroundColor: ORANGE[100] },
  pendingPillText: { fontSize: 15, fontFamily: FONT.semiBold, color: ORANGE[800] },
  verifyActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  verifyButton: { flex: 1, minHeight: 48, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center" },
  rejectButton: { backgroundColor: RED[600] },
  approveButton: { backgroundColor: GREEN[600] },
  verifyButtonText: { fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[0] },
  actionButtonDisabled: { opacity: 0.65 },
  documentGallery: { paddingRight: 8, gap: 10 },
  documentPreviewWrap: { marginTop: 14, alignSelf: "flex-start" },
  documentImage: { width: 104, height: 70, borderRadius: CORNER.small, backgroundColor: NEUTRAL[100] },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 12 },
  filterChip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: CORNER.pill, borderWidth: 1 },
  filterChipText: { fontSize: 15, fontFamily: FONT.semiBold },
  limitNotice: { marginTop: 10, fontSize: 15, fontFamily: FONT.medium, fontStyle: "italic" },
  userLine: { fontFamily: FONT.regular, marginTop: 9, fontSize: 15, lineHeight: 22 },
  userActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  smallActionButton: { minHeight: 38, paddingHorizontal: 14, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center" },
  editButton: { backgroundColor: GREEN[600] },
  deleteButton: { backgroundColor: RED[600] },
  smallActionButtonText: { fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[0] },
  vehicleToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  // Buttons (DESIGN.md Style): pills. Primary = green fill, white words. Secondary = white, grey edge, green words.
  primaryActionButton: { minHeight: 48, paddingHorizontal: 20, borderRadius: CORNER.pill, backgroundColor: GREEN[600], alignItems: "center", justifyContent: "center" },
  primaryActionButtonText: { fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[0] },
  secondaryActionButton: { minHeight: 48, paddingHorizontal: 20, borderRadius: CORNER.pill, borderWidth: 1.5, borderColor: NEUTRAL[500], backgroundColor: NEUTRAL[0], alignItems: "center", justifyContent: "center" },
  secondaryActionButtonText: { fontSize: 15, fontFamily: FONT.semiBold, color: GREEN[700] },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 14 },
  vehicleCard: { flexGrow: 1, flexBasis: 320, maxWidth: 420, padding: 18, borderRadius: CORNER.card, borderWidth: 1 },
  vehicleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  vehicleHeaderCopy: { flex: 1 },
  vehicleTitle: { fontSize: 22, fontFamily: FONT.bold },
  vehicleMeta: { marginTop: 8, fontSize: 15, fontFamily: FONT.semiBold },
  emptyState: { marginTop: 14, padding: 18, borderRadius: CORNER.card, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: FONT.bold, textAlign: "center" },
  emptyText: { fontFamily: FONT.regular, marginTop: 2, fontSize: 15, lineHeight: 22, textAlign: "center" },
  infoPanel: { marginTop: 12, padding: 16, borderRadius: CORNER.card, borderWidth: 1, gap: 8 },
  infoPanelTitle: { fontSize: 16, fontFamily: FONT.bold },
  infoPanelText: { fontSize: 15, lineHeight: 22, fontFamily: FONT.medium },
  // ---- Pop-ups (DESIGN.md Style): a dark see-through backdrop, white dialogs with 16 corners and a Level 3 shadow. ----
  modalOverlay: { flex: 1, backgroundColor: "rgba(20, 33, 28, 0.55)", alignItems: "center", justifyContent: "center", padding: 12 },
  modalCard: { width: "100%", maxWidth: 560, maxHeight: "92%", borderRadius: CORNER.card, borderWidth: 1, ...SHADOW.level3 },
  modalScrollContent: { padding: 20, gap: 12 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  modalTitle: { fontSize: 24, fontFamily: FONT.bold },
  modalSubtitle: { fontFamily: FONT.regular, marginTop: 5, fontSize: 15, lineHeight: 22 },
  modalCloseButton: { width: 38, height: 38, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[100], alignItems: "center", justifyContent: "center" },
  detailBox: { padding: 16, borderRadius: CORNER.input, gap: 8 },
  detailLine: { fontSize: 15, lineHeight: 22, fontFamily: FONT.medium },
  menuOverlay: { flex: 1, backgroundColor: "rgba(20, 33, 28, 0.18)", paddingTop: 86, paddingRight: 18, alignItems: "flex-end" },
  // The account menu under the initials circle (a menu: 16 corners, Level 2 shadow).
  profileMenuCard: {
    width: 320,
    maxWidth: "92%",
    borderRadius: CORNER.card,
    borderWidth: 1,
    borderColor: NEUTRAL[200],
    backgroundColor: NEUTRAL[0],
    padding: 18,
    ...SHADOW.level2,
  },
  profileMenuHeader: { alignItems: "center", paddingBottom: 16, borderBottomWidth: 1 },
  profileMenuAvatar: { width: 64, height: 64, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center" },
  profileMenuAvatarText: { fontSize: 22, fontFamily: FONT.bold },
  profileMenuName: { marginTop: 12, fontSize: 18, fontFamily: FONT.bold },
  profileMenuEmail: { fontFamily: FONT.regular, marginTop: 4, fontSize: 15 },
  profileMenuBody: { paddingTop: 12, gap: 4 },
  menuItem: { minHeight: 48, borderRadius: CORNER.input, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuItemText: { fontSize: 15, fontFamily: FONT.semiBold },
  menuItemDisabled: { opacity: 0.58 },
  menuItemSoon: { fontSize: 15, fontFamily: FONT.semiBold },
  // Log Out: a secondary pill (white, grey edge, green words), the same as the dispatcher's.
  logoutMenuButton: { marginTop: 14, minHeight: 48, borderRadius: CORNER.pill, borderWidth: 1.5, borderColor: NEUTRAL[500], alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL[0] },
  logoutMenuButtonText: { fontSize: 15, fontFamily: FONT.semiBold, color: GREEN[700] },
  profileEditorCard: { width: "100%", maxWidth: 560, backgroundColor: NEUTRAL[0], borderRadius: CORNER.card, borderWidth: 1, padding: 22, ...SHADOW.level3 },
  // The X at the top-right of Edit Account, Vehicle editor and Profile.
  closeInCorner: { alignSelf: "flex-end" },
  profileFieldLabel: { marginTop: 22, fontSize: 15, fontFamily: FONT.semiBold },
  // Inputs (DESIGN.md Style): white, 12 corners, a 1.5 edge (grey in the code; lighter on read-only boxes).
  profileInput: { fontFamily: FONT.regular, marginTop: 10, minHeight: 50, borderWidth: 1.5, borderRadius: CORNER.input, paddingHorizontal: 14, backgroundColor: NEUTRAL[0], fontSize: 15, color: NEUTRAL[900] },
  // Read-only boxes get a grey fill and a light edge in the code, so they don't look like they can be typed in.
  readOnlyInput: {},
  primarySaveButton: { marginTop: 28, minHeight: 56, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[600] },
  primarySaveButtonText: { fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[0] },
  confirmCard: { width: "100%", maxWidth: 520, borderRadius: CORNER.card, borderWidth: 1, padding: 22, ...SHADOW.level3 },
  confirmActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  confirmButton: { flex: 1, minWidth: 180 },
  imageModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  imageModalCloseArea: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  imageModalPreview: { width: "100%", height: "84%" },
  imageModalCloseText: { marginTop: 12, fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[0] },
  feedbackText: { marginTop: 16, fontSize: 15, fontFamily: FONT.semiBold, color: GREEN[700] },
  errorText: { marginTop: 16, fontSize: 15, fontFamily: FONT.semiBold, color: RED[600] },
});
