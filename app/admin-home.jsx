import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import BrandLogo from "../components/BrandLogo";
import AdminCallSessionsSection from "../features/admin/components/AdminCallSessionsSection";
import AdminOperationsPanel from "../features/admin/components/AdminOperationsPanel";
import AdminOverviewSection from "../features/admin/components/AdminOverviewSection";
import AdminRequestsSection from "../features/admin/components/AdminRequestsSection";
import AdminUsersSection from "../features/admin/components/AdminUsersSection";
import AdminVehiclesSection from "../features/admin/components/AdminVehiclesSection";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import { db } from "../firebase";
import useAdminCallSessions from "../features/admin/hooks/useAdminCallSessions";
import useAdminDashboardData from "../features/admin/hooks/useAdminDashboardData";
import { logAdminActivity } from "../features/admin/services/adminOperationsService";
import { getApprovalStatus, getUserName } from "../features/admin/utils/userFormatters";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import {
  formatDateTime,
  getAverageDuration,
  getDateFromValue,
  getDurationLabel,
} from "../lib/dates";
import { getAuthErrorMessage, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

const CITY_VEHICLE_OWNER = "City/Barangay Vehicle";
const DRIVER_VEHICLE_OWNER = "Driver-Owned Vehicle";
const sideLinks = ["Overview", "Emergency Calls", "Operations", "Requests", "Users", "Vehicles"];
const userRoleViews = ["All", "Resident", "Driver", "Dispatcher", "Admin"];
const requestStatusFilters = ["All", "Pending", "Assigned", "In Progress", "Completed", "Cancelled"];
const requestTypeFilters = ["All", "Emergency Requests", "Community Transport Requests"];
const accountStatusOptions = ["Active", "Approved", "Pending", "Rejected", "Deactivated"];
const vehicleStatusOptions = ["Available", "Assigned", "In Use", "Inactive"];
const cityVehicleOwnerOptions = [CITY_VEHICLE_OWNER];

const normalizeRole = (role = "") => role.toLowerCase();
const applicationUsesOwnVehicle = (application) =>
  application?.useOwnVehicle === true ||
  Boolean(application?.vehicleMake || application?.vehicleModel || application?.plateNumber || application?.uploaded_document);

const getVehicleNameFromApplication = (application) => {
  if (!applicationUsesOwnVehicle(application)) {
    return "No personal vehicle submitted";
  }

  const parts = [application.vehicleYear, application.vehicleMake, application.vehicleModel].filter(Boolean);
  return parts.join(" ") || "Driver-Owned Vehicle";
};

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
  ownerUid: "",
  driverName: "",
  status: "Available",
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

    return Math.max(540, height - 210);
  }, [compact, height]);
  const { authUser, displayName, profile, profileStatus } = useCurrentUserProfile();
  const { theme, toggleTheme } = useTheme();

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

  const {
    users,
    driverApplications,
    transportRequests,
    vehicles,
    driverAssignments,
    isLoadingUsers,
    isLoadingRequests,
    isLoadingVehicles,
    usersError,
    setUsersError,
    requestsError,
    vehiclesError,
    setVehiclesError,
    usersAtLimit,
    requestsAtLimit,
    vehiclesAtLimit,
    collectionLimit,
    counts,
  } = useAdminDashboardData(adminAccessStatus === "authorized");

  const { callSessions, staleRingingCount, isLoadingCallSessions, callSessionsError } = useAdminCallSessions(
    adminAccessStatus === "authorized"
  );

  const [userMessage, setUserMessage] = useState("");
  const [vehicleMessage, setVehicleMessage] = useState("");
  const [syncingVehicles, setSyncingVehicles] = useState(false);

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

  const pendingApplications = useMemo(
    () => driverApplications.filter((application) => application.status === "Pending"),
    [driverApplications]
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
      const requestTypeLabel = request.requestTypeLabel;
      const matchesStatus = requestStatusFilter === "All" || requestStatus === requestStatusFilter;
      const matchesType =
        requestTypeFilter === "All" ||
        (requestTypeFilter === "Emergency Requests" && requestTypeLabel === "Emergency Request") ||
        (requestTypeFilter === "Community Transport Requests" && requestTypeLabel === "Community Transport Request");

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

  const totalEmergencyRequests = useMemo(
    () => requestsWithDerivedFields.filter((request) => request.requestTypeLabel === "Emergency Request").length,
    [requestsWithDerivedFields]
  );

  const totalCommunityRequests = useMemo(
    () => requestsWithDerivedFields.filter((request) => request.requestTypeLabel === "Community Transport Request").length,
    [requestsWithDerivedFields]
  );

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
  const overviewCards = [
    { label: "Total Emergency Requests", value: counts.emergencyRequests ?? totalEmergencyRequests },
    { label: "Total Community Transport Requests", value: counts.communityRequests ?? totalCommunityRequests },
    { label: "Active Requests", value: counts.activeRequests ?? activeRequestsCount },
    { label: "Completed Requests", value: counts.completedRequests ?? completedRequestsCount },
    { label: "Cancelled Requests", value: counts.cancelledRequests ?? cancelledRequestsCount },
    { label: "Total Registered Drivers", value: counts.registeredDrivers ?? totalRegisteredDrivers },
    { label: "Available Drivers", value: counts.availableDrivers ?? availableDrivers },
    { label: "Total Registered Vehicles", value: counts.registeredVehicles ?? vehicles.length },
    { label: "Average Response Time", value: getDurationLabel(averageResponseTime) },
    { label: "Average Dispatch Time", value: getDurationLabel(averageDispatchTime) },
  ];

  const requestStatusStats = requestStatusFilters
    .filter((status) => status !== "All")
    .map((status) => ({
      label: status,
      value: requestsWithDerivedFields.filter((request) => (request.status || "Pending") === status).length,
    }));

  const activityBuckets = useMemo(
    () => buildActivityBuckets(rangeLabel, requestsWithDerivedFields),
    [rangeLabel, requestsWithDerivedFields]
  );
  const maxActivity = Math.max(...activityBuckets.map((bucket) => bucket.value), 1);

  const notifications = [
    `${pendingApplications.length} driver ${pendingApplications.length === 1 ? "application" : "applications"} waiting for review.`,
    `${dispatcherAccounts.length} dispatcher ${dispatcherAccounts.length === 1 ? "account" : "accounts"} currently registered.`,
    `${activeRequestsCount} request${activeRequestsCount === 1 ? "" : "s"} still active in the system.`,
  ];

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

  const syncApprovedDriverVehicles = async () => {
    setVehiclesError("");
    setVehicleMessage("");
    setSyncingVehicles(true);

    try {
      const approvedApplications = driverApplications.filter((application) => application.status === "Approved" && applicationUsesOwnVehicle(application));
      const batch = writeBatch(db);

      approvedApplications.forEach((application) => {
        const ownerProfile = usersById[application.driverUid];
        const activeAssignment = activeAssignments.find((assignment) => assignment.driverId === application.driverUid);
        const nextStatus = activeAssignment
          ? activeAssignment.status === "In Progress"
            ? "In Use"
            : "Assigned"
          : "Available";

        batch.set(
          doc(db, "vehicles", `driver-${application.driverUid}`),
          {
            name: getVehicleNameFromApplication(application),
            type: application.bodyType || application.vehicleModel || "Driver Vehicle",
            plateNumber: application.plateNumber || "",
            ownerType: DRIVER_VEHICLE_OWNER,
            ownerUid: application.driverUid,
            driverName: application.fullName || ownerProfile?.fullName || "Approved Driver",
            color: application.color || "",
            mvFileNumber: application.mvFileNumber || "",
            status: nextStatus,
            sourceApplicationId: application.id,
            applicationStatus: "Approved",
            bodyType: application.bodyType || "",
            vehicleMake: application.vehicleMake || "",
            vehicleModel: application.vehicleModel || "",
            vehicleYear: application.vehicleYear || "",
            useOwnVehicle: true,
            createdAt: application.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      if (approvedApplications.length) {
        const vehicleIds = approvedApplications.map((application) => `driver-${application.driverUid}`);
        logAdminActivity({
          adminId: authUser?.uid || "",
          action: "driver-vehicles-synced",
          targetType: "vehicle",
          targetId: "",
          summary: `${vehicleIds.length} driver-owned vehicle${vehicleIds.length === 1 ? "" : "s"} synced from approved applications.`,
          metadata: { count: vehicleIds.length, vehicleIds },
        }).catch((error) => console.log("Activity log warning:", error));
      }

      setVehicleMessage(
        approvedApplications.length
          ? "Driver-owned vehicle records synced from approved applications."
          : "No approved personal-vehicle applications were available to sync."
      );
    } catch (error) {
      console.log("Driver vehicle sync failed:", error);
      setVehiclesError("Approved driver vehicles could not be synced. Please check Firestore permissions.");
    } finally {
      setSyncingVehicles(false);
    }
  };

  const openUserEditor = (user) => {
    clearSectionMessages();
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

    setSavingUser(true);
    setUsersError("");
    setUserMessage("");

    try {
      const nextValues = {
        phoneNumber: userForm.phoneNumber.trim(),
        phone: userForm.phoneNumber.trim(),
        barangay: userForm.barangay.trim(),
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
      setUsersError("User account could not be updated. Please check Firestore permissions.");
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
            ownerUid: vehicle.ownerUid || "",
            driverName: vehicle.driverName || "",
            status: vehicle.derivedStatus || vehicle.status || "Available",
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
        ownerUid: vehicleForm.ownerUid || "",
        driverName: vehicleForm.driverName.trim(),
        status: vehicleForm.status,
        updatedAt: serverTimestamp(),
      };

      if (!vehicleForm.id) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, "vehicles", vehicleId), payload, { merge: true });

      logAdminActivity({
        adminId: authUser?.uid || "",
        action: vehicleForm.id ? "vehicle-updated" : "vehicle-created",
        targetType: "vehicle",
        targetId: vehicleId,
        summary: `${payload.name} was ${vehicleForm.id ? "updated" : "created"}.`,
        metadata: { plateNumber: payload.plateNumber, status: payload.status, ownerType: payload.ownerType },
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

    if (selectedSection === "Operations") {
      return <AdminOperationsPanel users={users} applications={driverApplications} vehicles={vehiclesWithDerivedStatus} assignments={driverAssignments} requests={requestsWithDerivedFields} adminId={authUser?.uid || ""} adminName={displayName} theme={theme} />;
    }

    if (selectedSection === "Requests") {
      return (
        <AdminRequestsSection
          theme={theme}
          styles={styles}
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
          theme={theme}
          styles={styles}
          userRoleViews={userRoleViews}
          userRoleView={userRoleView}
          setUserRoleView={setUserRoleView}
          isLoadingUsers={isLoadingUsers}
          filteredUsers={filteredUsers}
          usersError={usersError}
          userMessage={userMessage}
          openUserEditor={openUserEditor}
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
          syncingVehicles={syncingVehicles}
          syncApprovedDriverVehicles={syncApprovedDriverVehicles}
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
        theme={theme}
        styles={styles}
        notifications={notifications}
        overviewCards={overviewCards}
        rangeLabel={rangeLabel}
        setRangeLabel={setRangeLabel}
        activityBuckets={activityBuckets}
        maxActivity={maxActivity}
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

              <ScrollView style={styles.panelScrollArea} contentContainerStyle={styles.panelScrollContent} showsVerticalScrollIndicator={false}>
                {sideLinks.map((label) => {
                  const active = selectedSection === label;

                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.sideBlock, active && styles.sideBlockActive, { backgroundColor: active ? "#06774B" : "#EAF4EF" }]}
                      onPress={() => setSelectedSection(label)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[styles.sideBlockText, { color: active ? "#FFFFFF" : "#214238" }]}>{label}</Text>
                        {label === "Emergency Calls" && staleRingingCount > 0 ? (
                          <View style={{ backgroundColor: "#C53A3A", borderRadius: 999, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
                            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{staleRingingCount}</Text>
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
                <FontAwesome name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={[styles.detailBox, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.detailLine, { color: theme.text }]}>Resident: {selectedRequestRecord?.residentName || "Resident"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Request Type: {selectedRequestRecord?.requestTypeLabel || "Not available"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Emergency Type: {selectedRequestRecord?.emergencyType || "Not specified"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Pickup: {selectedRequestRecord?.pickupLocation || selectedRequestRecord?.barangay || "Not available"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Destination: {selectedRequestRecord?.destination || "Not available"}</Text>
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
            <TouchableOpacity style={styles.modalCloseCircle} onPress={() => setEditingUser(null)}>
              <Text style={styles.modalCloseCircleText}>X</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Account</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Update phone, barangay, address, and account status. Passwords are not editable from this client.
            </Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              value={userForm.fullName}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Phone number"
              placeholderTextColor={theme.subtleText}
              value={userForm.phoneNumber}
              onChangeText={(value) => setUserForm((current) => ({ ...current, phoneNumber: value }))}
              keyboardType="phone-pad"
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Barangay"
              placeholderTextColor={theme.subtleText}
              value={userForm.barangay}
              onChangeText={(value) => setUserForm((current) => ({ ...current, barangay: value }))}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Address</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
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
                      { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
                    ]}
                    disabled
                  >
                    <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : theme.text }]}>{status}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.primarySaveButton, savingUser && styles.actionButtonDisabled]} onPress={saveUserChanges} disabled={savingUser}>
              <Text style={styles.primarySaveButtonText}>{savingUser ? "Saving..." : "Save Changes"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={vehicleEditorOpen} transparent animationType="fade" onRequestClose={() => setVehicleEditorOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.profileEditorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.modalCloseCircle} onPress={() => setVehicleEditorOpen(false)}>
              <Text style={styles.modalCloseCircleText}>X</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: theme.text }]}>{vehicleForm.id ? "Edit Vehicle" : "Add Vehicle"}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Vehicle records are stored in the `vehicles` collection and used by dispatch and admin monitoring.</Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Name</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Vehicle name"
              placeholderTextColor={theme.subtleText}
              value={vehicleForm.name}
              onChangeText={(value) => setVehicleForm((current) => ({ ...current, name: value }))}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Type</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Ambulance, Van, SUV..."
              placeholderTextColor={theme.subtleText}
              value={vehicleForm.type}
              onChangeText={(value) => setVehicleForm((current) => ({ ...current, type: value }))}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Plate Number</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
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
                      { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
                    ]}
                    onPress={() => setVehicleForm((current) => ({ ...current, ownerType }))}
                  >
                    <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : theme.text }]}>{ownerType}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Driver Name</Text>
            <TextInput
              style={[styles.profileInput, vehicleForm.ownerType === DRIVER_VEHICLE_OWNER && styles.readOnlyInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Optional driver name"
              placeholderTextColor={theme.subtleText}
              value={vehicleForm.driverName}
              onChangeText={(value) => setVehicleForm((current) => ({ ...current, driverName: value }))}
              editable={vehicleForm.ownerType !== DRIVER_VEHICLE_OWNER}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Status</Text>
            <View style={styles.filterRow}>
              {vehicleStatusOptions.map((status) => {
                const active = vehicleForm.status === status;

                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
                    ]}
                    onPress={() => setVehicleForm((current) => ({ ...current, status }))}
                  >
                    <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : theme.text }]}>{status}</Text>
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
            <TouchableOpacity style={styles.modalCloseCircle} onPress={() => setProfileEditorOpen(false)}>
              <Text style={styles.modalCloseCircleText}>X</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Profile</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>This profile sheet remains view-only for the admin session.</Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              value={profile?.fullName || displayName}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              value={profile?.phoneNumber || ""}
              editable={false}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
            <TextInput
              style={[styles.profileInput, styles.readOnlyInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              value={profile?.barangay || TOLEDO_BARANGAY_OPTIONS[0]?.label || ""}
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  accessPage: { flex: 1, backgroundColor: "#F5F7F6", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  accessText: { fontSize: 15, fontWeight: "800", color: "#335E50", textAlign: "center" },
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
  container: { width: "100%", alignSelf: "stretch", paddingHorizontal: 22, paddingTop: 20 },
  containerCompact: { paddingHorizontal: 12, paddingTop: 14 },
  layoutRow: { width: "100%", flexDirection: "row", flexWrap: "nowrap", gap: 18, alignItems: "stretch" },
  layoutRowCompact: { flexWrap: "wrap" },
  sidebar: {
    width: 236,
    flexShrink: 0,
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
    alignSelf: "stretch",
  },
  sidebarCompact: {
    width: "100%",
    alignSelf: "stretch",
  },
  sidebarTitle: { fontSize: 20, fontWeight: "900" },
  sidebarSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  panelScrollArea: { flex: 1 },
  panelScrollContent: { gap: 10, paddingBottom: 2 },
  sideBlock: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sideBlockActive: { backgroundColor: "#06774B" },
  sideBlockText: { flex: 1, fontSize: 14, fontWeight: "800", textAlign: "center" },
  mainArea: { flex: 1, minWidth: 0, gap: 12 },
  contentPanel: { padding: 14, borderRadius: 18, borderWidth: 1 },
  contentPanelFixed: { flex: 1, minHeight: 0 },
  contentPanelScrollContent: { paddingBottom: 2 },
  notificationPanel: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
  },
  notificationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationTitle: { fontSize: 16, fontWeight: "900" },
  notificationText: { fontSize: 13, lineHeight: 20, fontWeight: "700" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 },
  metricCard: { flexGrow: 1, flexBasis: 180, padding: 16, borderRadius: 16, borderWidth: 1 },
  metricLabel: { fontSize: 12, fontWeight: "800" },
  metricValue: { marginTop: 10, fontSize: 28, fontWeight: "900" },
  chartCard: { marginTop: 12, padding: 18, borderRadius: 16, borderWidth: 1 },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  chartTitle: { fontSize: 20, fontWeight: "900" },
  chartSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19 },
  rangeButton: { minHeight: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rangeButtonText: { fontSize: 13, fontWeight: "800" },
  barRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 18, minHeight: 200 },
  barItem: { flex: 1, minWidth: 0, alignItems: "center" },
  barValue: { marginBottom: 6, fontSize: 16, fontWeight: "900" },
  barTrack: { width: 34, height: 142, borderRadius: 12, justifyContent: "flex-end", alignItems: "center", padding: 4 },
  bar: { width: "100%", borderRadius: 10 },
  dayText: { marginTop: 10, fontSize: 11, fontWeight: "800", paddingVertical: 4, paddingHorizontal: 6, borderRadius: 999 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 },
  statsPanel: { flexGrow: 1, flexBasis: 260, padding: 18, borderRadius: 16, borderWidth: 1 },
  statsPanelTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },
  statLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(127,127,127,0.18)" },
  statLineLabel: { flex: 1, fontSize: 13, fontWeight: "700" },
  statLineValue: { fontSize: 15, fontWeight: "900" },
  verificationSection: { marginTop: 14 },
  subsectionTitle: { fontSize: 18, fontWeight: "900" },
  verificationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 14 },
  verificationCard: { flexGrow: 1, flexBasis: 300, padding: 18, borderRadius: 14, borderWidth: 1 },
  verificationTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  verifyIdentity: { flexDirection: "row", gap: 12, flex: 1, minWidth: 0 },
  verifyAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  verifyIdentityCopy: { flex: 1 },
  verifyName: { fontSize: 20, fontWeight: "900" },
  verifyMeta: { marginTop: 4, fontSize: 13, fontWeight: "700" },
  verifyDetail: { marginTop: 10, fontSize: 14, lineHeight: 21 },
  pendingPill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, backgroundColor: "#F5A623" },
  pendingPillText: { fontSize: 12, fontWeight: "900", color: "#111111" },
  verifyActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  verifyButton: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rejectButton: { backgroundColor: "#C62828" },
  approveButton: { backgroundColor: "#06774B" },
  verifyButtonText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  actionButtonDisabled: { opacity: 0.65 },
  documentGallery: { paddingRight: 8, gap: 10 },
  documentPreviewWrap: { marginTop: 14, alignSelf: "flex-start" },
  documentImage: { width: 104, height: 70, borderRadius: 10, backgroundColor: "#EAF2EE" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 12 },
  filterChip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: "800" },
  filterField: { flexGrow: 1, flexBasis: 220, marginTop: 12, marginBottom: 12 },
  filterFieldLabel: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
  dropdown: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 },
  dropdownContainer: { borderWidth: 1, borderRadius: 10 },
  dropdownText: { fontSize: 14, fontWeight: "700" },
  limitNotice: { marginTop: 10, fontSize: 12, fontWeight: "700", fontStyle: "italic" },
  requestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  requestCard: { flexGrow: 1, flexBasis: 320, padding: 18, borderRadius: 14, borderWidth: 1 },
  requestCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  requestLevelPill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999 },
  requestLevelText: { fontSize: 12, fontWeight: "900", color: "#111111" },
  requestStatusText: { fontSize: 12, fontWeight: "800" },
  requestTitle: { marginTop: 14, fontSize: 18, fontWeight: "900" },
  requestMeta: { marginTop: 7, fontSize: 13, lineHeight: 19 },
  requestViewButton: { marginTop: 16, minHeight: 42, borderRadius: 12, backgroundColor: "#06774B", alignItems: "center", justifyContent: "center" },
  requestViewButtonText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  usersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  userCard: { flexGrow: 1, flexBasis: 300, padding: 18, borderRadius: 14, borderWidth: 1 },
  userCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  userIdentity: { flexDirection: "row", gap: 12, flex: 1, minWidth: 0 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  userIdentityCopy: { flex: 1 },
  userName: { fontSize: 18, fontWeight: "900" },
  userRole: { marginTop: 4, fontSize: 13, fontWeight: "700" },
  userStatusPill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999 },
  userStatusText: { fontSize: 12, fontWeight: "900", color: "#111111" },
  userLine: { marginTop: 9, fontSize: 14, lineHeight: 21 },
  userActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  smallActionButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  editButton: { backgroundColor: "#06774B" },
  deactivateButton: { backgroundColor: "#A86900" },
  deleteButton: { backgroundColor: "#C62828" },
  smallActionButtonText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  vehicleToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  primaryActionButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#06774B", alignItems: "center", justifyContent: "center" },
  primaryActionButtonText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  secondaryActionButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#DDEAE4", alignItems: "center", justifyContent: "center" },
  secondaryActionButtonText: { fontSize: 14, fontWeight: "800", color: "#214238" },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 14 },
  vehicleCard: { flexGrow: 1, flexBasis: 320, maxWidth: 420, padding: 18, borderRadius: 16, borderWidth: 1 },
  vehicleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  vehicleHeaderCopy: { flex: 1 },
  vehicleTitle: { fontSize: 22, fontWeight: "900" },
  vehicleMeta: { marginTop: 8, fontSize: 14, fontWeight: "800" },
  emptyState: { marginTop: 14, padding: 18, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyText: { marginTop: 2, fontSize: 13, lineHeight: 19, textAlign: "center" },
  infoPanel: { marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  infoPanelTitle: { fontSize: 16, fontWeight: "900" },
  infoPanelText: { fontSize: 13, lineHeight: 20, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center", padding: 12 },
  modalCard: { width: "100%", maxWidth: 560, maxHeight: "92%", borderRadius: 18, borderWidth: 1 },
  modalScrollContent: { padding: 20, gap: 12 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  modalTitle: { fontSize: 24, fontWeight: "900" },
  modalSubtitle: { marginTop: 5, fontSize: 13, lineHeight: 19 },
  modalCloseButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EAF2EE", alignItems: "center", justifyContent: "center" },
  detailBox: { padding: 16, borderRadius: 14, gap: 8 },
  detailLine: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
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
  menuItemDisabled: { opacity: 0.58 },
  menuItemSoon: { fontSize: 12, fontWeight: "800" },
  themePill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  themePillText: { fontSize: 12, fontWeight: "800" },
  logoutMenuButton: { marginTop: 14, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0B7A4A" },
  logoutMenuButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  profileEditorCard: { width: "100%", maxWidth: 560, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, padding: 22 },
  modalCloseCircle: { alignSelf: "flex-end", width: 42, height: 42, borderRadius: 21, backgroundColor: "#F51D1D", alignItems: "center", justifyContent: "center" },
  modalCloseCircleText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  profileFieldLabel: { marginTop: 22, fontSize: 15, fontWeight: "700" },
  profileInput: { marginTop: 10, minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, backgroundColor: "#FCFCFC", fontSize: 15, color: "#111111" },
  readOnlyInput: { opacity: 0.78 },
  primarySaveButton: { marginTop: 28, minHeight: 52, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#06774B" },
  primarySaveButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  confirmCard: { width: "100%", maxWidth: 520, borderRadius: 20, borderWidth: 1, padding: 22 },
  confirmActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  confirmButton: { flex: 1, minWidth: 180 },
  imageModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  imageModalCloseArea: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  imageModalPreview: { width: "100%", height: "84%" },
  imageModalCloseText: { marginTop: 12, fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  feedbackText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#335E50" },
  errorText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#B42318" },
});
