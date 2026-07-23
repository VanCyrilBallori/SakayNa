import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

const ADMIN_ROLE = "Admin";
const CITY_VEHICLE_OWNER = "City/Barangay Vehicle";
const DRIVER_VEHICLE_OWNER = "Driver-Owned Vehicle";
const sideLinks = ["Overview", "Staff Management", "Requests", "Users", "Vehicles"];
const userRoleViews = ["All", "Resident", "Driver", "Dispatcher", "Admin"];
const requestStatusFilters = ["All", "Pending", "Assigned", "In Progress", "Completed", "Cancelled"];
const requestTypeFilters = ["All", "Emergency Requests", "Community Transport Requests"];
const accountStatusOptions = ["Active", "Approved", "Pending", "Rejected", "Deactivated"];
const vehicleStatusOptions = ["Available", "Assigned", "In Use", "Inactive"];
const cityVehicleOwnerOptions = [CITY_VEHICLE_OWNER];

const getDateFromValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTimestampMillis = (value) => getDateFromValue(value)?.getTime() ?? null;

const formatDate = (value) => {
  const date = getDateFromValue(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  const date = getDateFromValue(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const normalizeRole = (role = "") => role.toLowerCase();
const getUserPhone = (user) => user.phoneNumber || user.phone || "Not provided";
const getUserName = (user) => user.fullName || user.displayName || user.email || "Registered User";
const getUserAddress = (user) => user.address || user.pickupDetails || "Not provided";
const getApprovalStatus = (user) => user.accountStatus || user.approvalStatus || user.status || "Active";
const getProfilePhoto = (record) => record.profilePhoto || record.photoURL || record.avatarUrl || "";
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

const getDurationLabel = (milliseconds) => {
  if (typeof milliseconds !== "number" || Number.isNaN(milliseconds)) {
    return "Not enough data";
  }

  if (milliseconds < 60_000) {
    return `${Math.max(1, Math.round(milliseconds / 1000))} sec`;
  }

  const minutes = Math.round(milliseconds / 60_000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

const getAverageDuration = (requests, endFieldNames) => {
  const durations = requests
    .map((request) => {
      const createdAt = getTimestampMillis(request.createdAt);
      const endingField = endFieldNames.find((fieldName) => request[fieldName]);
      const endedAt = endingField ? getTimestampMillis(request[endingField]) : null;

      if (!createdAt || !endedAt || endedAt < createdAt) {
        return null;
      }

      return endedAt - createdAt;
    })
    .filter((value) => typeof value === "number");

  if (!durations.length) {
    return null;
  }

  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
};

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
  const { width } = useWindowDimensions();
  const compact = width < 1080;
  const narrow = width < 560;
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const { theme, toggleTheme } = useTheme();

  const [adminAccessStatus, setAdminAccessStatus] = useState("checking");
  const [selectedSection, setSelectedSection] = useState("Overview");
  const [searchValue, setSearchValue] = useState("");
  const [rangeLabel, setRangeLabel] = useState("Week");
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const [requestTypeFilter, setRequestTypeFilter] = useState("All");
  const [userRoleView, setUserRoleView] = useState("All");

  const [users, setUsers] = useState([]);
  const [driverApplications, setDriverApplications] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [driverAssignments, setDriverAssignments] = useState([]);

  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);

  const [usersError, setUsersError] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [vehiclesError, setVehiclesError] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [vehicleMessage, setVehicleMessage] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
  const [syncingVehicles, setSyncingVehicles] = useState(false);

  const [selectedRequestRecord, setSelectedRequestRecord] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [confirmingUserDelete, setConfirmingUserDelete] = useState(null);
  const [confirmingUserDeactivate, setConfirmingUserDeactivate] = useState(null);

  const [vehicleEditorOpen, setVehicleEditorOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [confirmingVehicleDelete, setConfirmingVehicleDelete] = useState(null);

  const initials = useMemo(() => {
    const words = displayName.split(" ").filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "A";
  }, [displayName]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminAccessStatus("unauthorized");
        router.replace("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? userDoc.data()?.role : "";

        if (role === ADMIN_ROLE) {
          setAdminAccessStatus("authorized");
          return;
        }

        setAdminAccessStatus("unauthorized");
        router.replace("/login");
      } catch (error) {
        console.log("Admin role check failed:", error);
        setAdminAccessStatus("unauthorized");
        router.replace("/login");
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (adminAccessStatus !== "authorized") {
      return undefined;
    }

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
        setUsersError("");
        setIsLoadingUsers(false);
      },
      (error) => {
        console.log("Users listener warning:", error);
        setUsersError("Users could not be loaded. Please check Firestore permissions.");
        setIsLoadingUsers(false);
      }
    );

    const unsubscribeApplications = onSnapshot(
      collection(db, "Driver_Applications"),
      (snapshot) => {
        const nextApplications = snapshot.docs
          .map((applicationDoc) => ({ id: applicationDoc.id, ...applicationDoc.data() }))
          .sort((first, second) => (getTimestampMillis(second.createdAt) ?? 0) - (getTimestampMillis(first.createdAt) ?? 0));

        setDriverApplications(nextApplications);
        setApplicationsError("");
        setIsLoadingApplications(false);
      },
      (error) => {
        console.log("Driver applications listener warning:", error);
        setApplicationsError("Driver applications could not be loaded. Please check Firestore permissions.");
        setIsLoadingApplications(false);
      }
    );

    const unsubscribeRequests = onSnapshot(
      collection(db, "transportRequests"),
      (snapshot) => {
        const nextRequests = snapshot.docs
          .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }))
          .sort((first, second) => (getTimestampMillis(second.createdAt) ?? 0) - (getTimestampMillis(first.createdAt) ?? 0));

        setTransportRequests(nextRequests);
        setRequestsError("");
        setIsLoadingRequests(false);
      },
      (error) => {
        console.log("Transport requests listener warning:", error);
        setRequestsError("Transport requests could not be loaded. Please check Firestore permissions.");
        setIsLoadingRequests(false);
      }
    );

    const unsubscribeVehicles = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        const nextVehicles = snapshot.docs
          .map((vehicleDoc) => ({ id: vehicleDoc.id, ...vehicleDoc.data() }))
          .sort((first, second) => (getTimestampMillis(second.createdAt) ?? 0) - (getTimestampMillis(first.createdAt) ?? 0));

        setVehicles(nextVehicles);
        setVehiclesError("");
        setIsLoadingVehicles(false);
      },
      (error) => {
        console.log("Vehicles listener warning:", error);
        setVehiclesError("Vehicles could not be loaded. Please check Firestore permissions.");
        setIsLoadingVehicles(false);
      }
    );

    const unsubscribeAssignments = onSnapshot(
      collection(db, "driverAssignments"),
      (snapshot) => {
        setDriverAssignments(snapshot.docs.map((assignmentDoc) => ({ id: assignmentDoc.id, ...assignmentDoc.data() })));
      },
      (error) => console.log("Driver assignments listener warning:", error)
    );

    return () => {
      unsubscribeUsers();
      unsubscribeApplications();
      unsubscribeRequests();
      unsubscribeVehicles();
      unsubscribeAssignments();
    };
  }, [adminAccessStatus]);

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
    const query = searchValue.trim().toLowerCase();

    return requestsWithDerivedFields.filter((request) => {
      const requestStatus = request.status || "Pending";
      const requestTypeLabel = request.requestTypeLabel;
      const matchesStatus = requestStatusFilter === "All" || requestStatus === requestStatusFilter;
      const matchesType =
        requestTypeFilter === "All" ||
        (requestTypeFilter === "Emergency Requests" && requestTypeLabel === "Emergency Request") ||
        (requestTypeFilter === "Community Transport Requests" && requestTypeLabel === "Community Transport Request");
      const matchesSearch =
        !query ||
        request.id.toLowerCase().includes(query) ||
        (request.residentName || "").toLowerCase().includes(query) ||
        requestTypeLabel.toLowerCase().includes(query) ||
        (request.emergencyType || "").toLowerCase().includes(query) ||
        (request.pickupLocation || "").toLowerCase().includes(query) ||
        (request.destination || "").toLowerCase().includes(query) ||
        request.vehicleLabel.toLowerCase().includes(query) ||
        (request.assignedDriverName || "").toLowerCase().includes(query);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [requestStatusFilter, requestTypeFilter, requestsWithDerivedFields, searchValue]);

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return users.filter((user) => {
      const role = user.role || "";
      const matchesRole = userRoleView === "All" || role === userRoleView;
      const matchesSearch =
        !query ||
        getUserName(user).toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        getUserPhone(user).toLowerCase().includes(query) ||
        (user.barangay || "").toLowerCase().includes(query) ||
        (user.address || "").toLowerCase().includes(query);

      return matchesRole && matchesSearch;
    });
  }, [searchValue, userRoleView, users]);

  const vehiclesWithDerivedStatus = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        ...vehicle,
        derivedStatus: getVehicleDerivedStatus(vehicle, activeAssignments, usersById),
      })),
    [activeAssignments, usersById, vehicles]
  );

  const filteredVehicles = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return vehiclesWithDerivedStatus.filter((vehicle) => {
      if (!query) {
        return true;
      }

      return [
        vehicle.name,
        vehicle.type,
        vehicle.plateNumber,
        vehicle.ownerType,
        vehicle.driverName,
        vehicle.ownerUid,
      ]
        .filter(Boolean)
        .some((value) => `${value}`.toLowerCase().includes(query));
    });
  }, [searchValue, vehiclesWithDerivedStatus]);

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

  const overviewCards = [
    { label: "Total Emergency Requests", value: totalEmergencyRequests },
    { label: "Total Community Transport Requests", value: totalCommunityRequests },
    { label: "Active Requests", value: activeRequestsCount },
    { label: "Completed Requests", value: completedRequestsCount },
    { label: "Cancelled Requests", value: cancelledRequestsCount },
    { label: "Total Registered Drivers", value: totalRegisteredDrivers },
    { label: "Available Drivers", value: availableDrivers },
    { label: "Total Registered Vehicles", value: vehicles.length },
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
    setStaffMessage("");
    setUserMessage("");
    setVehicleMessage("");
  };

  const updateApplicationStatus = async (application, status) => {
    if (adminAccessStatus !== "authorized") {
      setApplicationsError("Only admins can update driver applications.");
      return;
    }

    if (!application?.driverUid) {
      setApplicationsError("This application is missing the driver's Authentication UID.");
      return;
    }

    setApplicationsError("");
    setStaffMessage("");
    setUpdatingApplicationId(application.id);

    try {
      const batch = writeBatch(db);
      const statusTimestamp = status === "Approved" ? { approvedAt: serverTimestamp() } : { rejectedAt: serverTimestamp() };
      const ownerProfile = usersById[application.driverUid];
      const activeAssignment = activeAssignments.find((assignment) => assignment.driverId === application.driverUid);
      const nextVehicleStatus =
        status === "Approved"
          ? activeAssignment
            ? activeAssignment.status === "In Progress"
              ? "In Use"
              : "Assigned"
            : "Available"
          : "Inactive";

      batch.update(doc(db, "Driver_Applications", application.id), {
        status,
        ...statusTimestamp,
      });

      batch.update(doc(db, "users", application.driverUid), {
        accountStatus: status,
        useOwnVehicle: applicationUsesOwnVehicle(application),
        updatedAt: serverTimestamp(),
        ...statusTimestamp,
      });

      if (status === "Approved" && applicationUsesOwnVehicle(application)) {
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
            status: nextVehicleStatus,
            sourceApplicationId: application.id,
            applicationStatus: status,
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
      }

      await batch.commit();
      setStaffMessage(`Application ${status.toLowerCase()} successfully.`);
    } catch (error) {
      console.log("Driver application status update failed:", error);
      setApplicationsError("Application status could not be updated. Please check Firestore permissions.");
    } finally {
      setUpdatingApplicationId("");
    }
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
      await updateDoc(doc(db, "users", editingUser.id), {
        phoneNumber: userForm.phoneNumber.trim(),
        phone: userForm.phoneNumber.trim(),
        barangay: userForm.barangay.trim(),
        address: userForm.address.trim(),
        accountStatus: userForm.accountStatus,
        updatedAt: serverTimestamp(),
      });

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

  const deactivateUser = async (user) => {
    if (!user?.id) {
      return;
    }

    setSavingUser(true);
    setUsersError("");
    setUserMessage("");

    try {
      await updateDoc(doc(db, "users", user.id), {
        accountStatus: "Deactivated",
        ...(normalizeRole(user.role) === "driver" ? { availability: "Unavailable" } : {}),
        updatedAt: serverTimestamp(),
      });

      setUserMessage(`${getUserName(user)} was deactivated.`);
      setConfirmingUserDeactivate(null);
    } catch (error) {
      console.log("User deactivation failed:", error);
      setUsersError("The account could not be deactivated. Please check Firestore permissions.");
    } finally {
      setSavingUser(false);
    }
  };

  const deleteUserRecord = async (user) => {
    if (!user?.id) {
      return;
    }

    setSavingUser(true);
    setUsersError("");
    setUserMessage("");

    try {
      await deleteDoc(doc(db, "users", user.id));
      setUserMessage(`${getUserName(user)} was removed from the users collection.`);
      setConfirmingUserDelete(null);
    } catch (error) {
      console.log("User delete failed:", error);
      setUsersError("The user record could not be deleted. Please check Firestore permissions.");
    } finally {
      setSavingUser(false);
    }
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
      await deleteDoc(doc(db, "vehicles", vehicle.id));
      setVehicleMessage(`${vehicle.name || "Vehicle"} was deleted.`);
      setConfirmingVehicleDelete(null);
    } catch (error) {
      console.log("Vehicle delete failed:", error);
      setVehiclesError("Vehicle record could not be deleted. Please check Firestore permissions.");
    } finally {
      setSavingVehicle(false);
    }
  };

  const renderOverview = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Overview</Text>
      </View>

      <View style={[styles.notificationPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.notificationHeader}>
          <FontAwesome name="bell" size={18} color="#06774B" />
          <Text style={[styles.notificationTitle, { color: theme.text }]}>Live Firestore Summary</Text>
        </View>
        {notifications.map((note) => (
          <Text key={note} style={[styles.notificationText, { color: theme.mutedText }]}>
            {note}
          </Text>
        ))}
      </View>

      <View style={styles.metricsGrid}>
        {overviewCards.map((metric) => (
          <View key={metric.label} style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>{metric.label}</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.chartCard, { backgroundColor: theme.softSurface, borderColor: theme.softSurfaceBorder }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Request Activity</Text>
            <Text style={[styles.chartSubtitle, { color: theme.mutedText }]}>Actual transport request submissions from Firestore.</Text>
          </View>
          <TouchableOpacity
            style={[styles.rangeButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() =>
              setRangeLabel((current) => (current === "Week" ? "Month" : current === "Month" ? "Year" : "Week"))
            }
          >
            <Text style={[styles.rangeButtonText, { color: theme.text }]}>{rangeLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.barRow}>
          {activityBuckets.map((bucket) => {
            const ratio = maxActivity ? bucket.value / maxActivity : 0;

            return (
              <View key={bucket.key} style={styles.barItem}>
                <Text style={[styles.barValue, { color: theme.text }]}>{bucket.value}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
                  <View style={[styles.bar, { height: Math.max(16, 132 * ratio), backgroundColor: "#08A967" }]} />
                </View>
                <Text style={[styles.dayText, { color: theme.text }]}>{bucket.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statsPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statsPanelTitle, { color: theme.text }]}>Request Status</Text>
          {requestStatusStats.map((stat) => (
            <View key={stat.label} style={styles.statLine}>
              <Text style={[styles.statLineLabel, { color: theme.mutedText }]}>{stat.label}</Text>
              <Text style={[styles.statLineValue, { color: theme.text }]}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  const renderStaffManagement = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Staff Management</Text>
      </View>

      <View style={[styles.infoPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.infoPanelTitle, { color: theme.text }]}>Create Dispatcher/Admin Accounts</Text>
        <Text style={[styles.infoPanelText, { color: theme.mutedText }]}>
          Staff accounts are not created automatically from this Admin dashboard because the approved project flow must not rely on Cloud Functions or insecure client-side role creation.
        </Text>
      </View>

      <View style={styles.verificationSection}>
        <Text style={[styles.subsectionTitle, { color: theme.text }]}>Driver Applications</Text>
        {isLoadingApplications ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator color="#06774B" />
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading driver applications...</Text>
          </View>
        ) : pendingApplications.length ? (
          <View style={styles.verificationGrid}>
            {pendingApplications.map((application) => {
              const isUpdating = updatingApplicationId === application.id;

              return (
                <View key={application.id} style={[styles.verificationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.verificationTop}>
                    <View style={styles.verifyIdentity}>
                      <View style={[styles.verifyAvatar, { backgroundColor: theme.avatarBg }]}>
                        <FontAwesome name="user" size={22} color={theme.avatarText} />
                      </View>
                      <View style={styles.verifyIdentityCopy}>
                        <Text style={[styles.verifyName, { color: theme.text }]}>{application.fullName || "Not provided"}</Text>
                        <Text style={[styles.verifyMeta, { color: theme.mutedText }]}>{application.email || "Not provided"}</Text>
                      </View>
                    </View>
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>Pending</Text>
                    </View>
                  </View>

                  <Text style={[styles.verifyDetail, { color: theme.text }]}>Phone: {application.phone || "Not provided"}</Text>
                  <Text style={[styles.verifyDetail, { color: theme.text }]}>License: {application.licenseNumber || "Not provided"}</Text>
                  <Text style={[styles.verifyDetail, { color: theme.text }]}>Vehicle Option: {applicationUsesOwnVehicle(application) ? "Driver-owned vehicle" : "Needs city/barangay vehicle"}</Text>
                  <Text style={[styles.verifyDetail, { color: theme.text }]}>Plate: {application.plateNumber || "Not provided"}</Text>
                  <Text style={[styles.verifyDetail, { color: theme.text }]}>Vehicle: {getVehicleNameFromApplication(application)}</Text>
                  {applicationUsesOwnVehicle(application) ? (
                    <>
                      <Text style={[styles.verifyDetail, { color: theme.text }]}>Body Type: {application.bodyType || "Not provided"}</Text>
                      <Text style={[styles.verifyDetail, { color: theme.text }]}>Color: {application.color || "Not provided"}</Text>
                      <Text style={[styles.verifyDetail, { color: theme.text }]}>MV File Number: {application.mvFileNumber || "Not provided"}</Text>
                    </>
                  ) : null}
                  <Text style={[styles.verifyDetail, { color: theme.mutedText }]}>Applied: {formatDate(application.createdAt)}</Text>

                  {application.uploaded_document ? (
                    <TouchableOpacity style={styles.documentPreviewWrap} onPress={() => setPreviewImageUrl(application.uploaded_document)}>
                      <Image source={{ uri: application.uploaded_document }} style={styles.documentImage} />
                    </TouchableOpacity>
                  ) : null}

                  {application.vehiclePhotoUrls?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.documentGallery}>
                      {application.vehiclePhotoUrls.map((photoUrl, index) => (
                        <TouchableOpacity key={`${application.id}-vehicle-photo-${index + 1}`} style={styles.documentPreviewWrap} onPress={() => setPreviewImageUrl(photoUrl)}>
                          <Image source={{ uri: photoUrl }} style={styles.documentImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}

                  <View style={styles.verifyActions}>
                    <TouchableOpacity
                      style={[styles.verifyButton, styles.rejectButton, isUpdating && styles.actionButtonDisabled]}
                      onPress={() => updateApplicationStatus(application, "Rejected")}
                      disabled={isUpdating}
                    >
                      <Text style={styles.verifyButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.verifyButton, styles.approveButton, isUpdating && styles.actionButtonDisabled]}
                      onPress={() => updateApplicationStatus(application, "Approved")}
                      disabled={isUpdating}
                    >
                      <Text style={styles.verifyButtonText}>{isUpdating ? "Saving..." : "Approve"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending driver applications</Text>
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>Approved and rejected applications remain stored in Firestore for records.</Text>
          </View>
        )}
      </View>

      <View style={styles.verificationSection}>
        <Text style={[styles.subsectionTitle, { color: theme.text }]}>Dispatcher Accounts</Text>
        {dispatcherAccounts.length ? (
          <View style={styles.usersGrid}>
            {dispatcherAccounts.map((user) => (
              <View key={user.id} style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.userCardTop}>
                  <View style={styles.userIdentity}>
                    <View style={[styles.userAvatar, { backgroundColor: theme.avatarBg }]}>
                      {getProfilePhoto(user) ? (
                        <Image source={{ uri: getProfilePhoto(user) }} style={styles.avatarImage} />
                      ) : (
                        <FontAwesome name="user" size={22} color={theme.avatarText} />
                      )}
                    </View>
                    <View style={styles.userIdentityCopy}>
                      <Text style={[styles.userName, { color: theme.text }]}>{getUserName(user)}</Text>
                      <Text style={[styles.userRole, { color: theme.mutedText }]}>Dispatcher</Text>
                    </View>
                  </View>
                  <View style={[styles.userStatusPill, { backgroundColor: "#DDF2E6" }]}>
                    <Text style={styles.userStatusText}>{getApprovalStatus(user)}</Text>
                  </View>
                </View>

                <Text style={[styles.userLine, { color: theme.text }]}>Email: {user.email || "Not provided"}</Text>
                <Text style={[styles.userLine, { color: theme.text }]}>Phone: {getUserPhone(user)}</Text>
                <Text style={[styles.userLine, { color: theme.text }]}>Status: {getApprovalStatus(user)}</Text>
                <Text style={[styles.userLine, { color: theme.mutedText }]}>Registered: {formatDate(user.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No dispatcher accounts found</Text>
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>Dispatcher accounts from the `users` collection will appear here.</Text>
          </View>
        )}
      </View>

      {applicationsError ? <Text style={styles.errorText}>{applicationsError}</Text> : null}
      {staffMessage ? <Text style={styles.feedbackText}>{staffMessage}</Text> : null}
    </>
  );

  const renderRequests = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Request History</Text>
      </View>

      <View style={styles.filterRow}>
        {requestTypeFilters.map((type) => {
          const active = requestTypeFilter === type;

          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterChip,
                { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
              ]}
              onPress={() => setRequestTypeFilter(type)}
            >
              <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : theme.text }]}>{type}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        {requestStatusFilters.map((status) => {
          const active = requestStatusFilter === status;

          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
              ]}
              onPress={() => setRequestStatusFilter(status)}
            >
              <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : theme.text }]}>{status}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoadingRequests ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#06774B" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading request history...</Text>
        </View>
      ) : filteredRequests.length ? (
        <View style={styles.requestGrid}>
          {filteredRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setSelectedRequestRecord(request)}
            >
              <View style={styles.requestCardTop}>
                <View style={[styles.requestLevelPill, { backgroundColor: request.requestTypeLabel === "Emergency Request" ? "#FAD9D9" : "#DDF2E6" }]}>
                  <Text style={styles.requestLevelText}>{request.requestTypeLabel}</Text>
                </View>
                <Text style={[styles.requestStatusText, { color: theme.mutedText }]}>{request.status || "Pending"}</Text>
              </View>

              <Text style={[styles.requestTitle, { color: theme.text }]}>{request.id}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Resident: {request.residentName || "Resident"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Emergency Type: {request.emergencyType || "Not specified"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Pickup: {request.pickupLocation || request.barangay || "Not available"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Destination: {request.destination || "Not available"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Assigned Driver: {request.assignedDriverName || "Unassigned"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Vehicle: {request.vehicleLabel}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Priority: {request.priorityLabel}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Submitted: {formatDateTime(request.createdAt)}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Completed: {formatDateTime(request.completedAt)}</Text>

              <TouchableOpacity style={styles.requestViewButton} onPress={() => setSelectedRequestRecord(request)}>
                <Text style={styles.requestViewButtonText}>View Details</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No request records match the active filters.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>{requestsError || "Transport requests will appear here once residents submit them."}</Text>
        </View>
      )}
    </>
  );

  const renderUsers = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>User Management</Text>
      </View>

      <View style={styles.filterRow}>
        {userRoleViews.map((role) => {
          const active = userRoleView === role;

          return (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
              ]}
              onPress={() => setUserRoleView(role)}
            >
              <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : theme.text }]}>{role}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoadingUsers ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#06774B" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading registered users...</Text>
        </View>
      ) : filteredUsers.length ? (
        <View style={styles.usersGrid}>
          {filteredUsers.map((user) => (
            <View key={user.id} style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.userCardTop}>
                <View style={styles.userIdentity}>
                  <View style={[styles.userAvatar, { backgroundColor: theme.avatarBg }]}>
                    {getProfilePhoto(user) ? (
                      <Image source={{ uri: getProfilePhoto(user) }} style={styles.avatarImage} />
                    ) : (
                      <FontAwesome name="user" size={22} color={theme.avatarText} />
                    )}
                  </View>
                  <View style={styles.userIdentityCopy}>
                    <Text style={[styles.userName, { color: theme.text }]}>{getUserName(user)}</Text>
                    <Text style={[styles.userRole, { color: theme.mutedText }]}>{user.role || "No role"}</Text>
                  </View>
                </View>
                <View style={[styles.userStatusPill, { backgroundColor: getApprovalStatus(user) === "Deactivated" ? "#F0E8E8" : "#DDF2E6" }]}>
                  <Text style={styles.userStatusText}>{getApprovalStatus(user)}</Text>
                </View>
              </View>

              <Text style={[styles.userLine, { color: theme.text }]}>Email: {user.email || "Not provided"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Phone: {getUserPhone(user)}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Barangay: {user.barangay || "Not provided"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Address: {getUserAddress(user)}</Text>
              <Text style={[styles.userLine, { color: theme.mutedText }]}>Created: {formatDate(user.createdAt)}</Text>

              <View style={styles.userActions}>
                <TouchableOpacity style={[styles.smallActionButton, styles.editButton]} onPress={() => openUserEditor(user)}>
                  <Text style={styles.smallActionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallActionButton, styles.deactivateButton]}
                  onPress={() => setConfirmingUserDeactivate(user)}
                >
                  <Text style={styles.smallActionButtonText}>Deactivate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallActionButton, styles.deleteButton]} onPress={() => setConfirmingUserDelete(user)}>
                  <Text style={styles.smallActionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No users match the selected view.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>{usersError || "Try a different role view or search term."}</Text>
        </View>
      )}

      {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
      {userMessage ? <Text style={styles.feedbackText}>{userMessage}</Text> : null}
    </>
  );

  const renderVehicles = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Vehicle Management</Text>
      </View>

      <View style={styles.vehicleToolbar}>
        <TouchableOpacity style={styles.primaryActionButton} onPress={() => openVehicleEditor()}>
          <Text style={styles.primaryActionButtonText}>Add City/Barangay Vehicle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryActionButton, syncingVehicles && styles.actionButtonDisabled]}
          onPress={syncApprovedDriverVehicles}
          disabled={syncingVehicles}
        >
          <Text style={styles.secondaryActionButtonText}>{syncingVehicles ? "Syncing..." : "Sync Driver-Owned Vehicles"}</Text>
        </TouchableOpacity>
      </View>

      {isLoadingVehicles ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#06774B" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading vehicle records...</Text>
        </View>
      ) : filteredVehicles.length ? (
        <View style={styles.vehicleRow}>
          {filteredVehicles.map((vehicle) => (
            <View key={vehicle.id} style={[styles.vehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.vehicleHeader}>
                <View style={styles.vehicleHeaderCopy}>
                  <Text style={[styles.vehicleTitle, { color: theme.text }]}>{vehicle.name || "Unnamed vehicle"}</Text>
                  <Text style={[styles.vehicleMeta, { color: theme.mutedText }]}>
                    {vehicle.type || "Vehicle"} | {vehicle.plateNumber || "No plate number"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.userStatusPill,
                    { backgroundColor: vehicle.derivedStatus === "Inactive" ? "#F0E8E8" : "#DDF2E6" },
                  ]}
                >
                  <Text style={styles.userStatusText}>{vehicle.derivedStatus}</Text>
                </View>
              </View>

              <Text style={[styles.userLine, { color: theme.text }]}>Owner Type: {vehicle.ownerType || CITY_VEHICLE_OWNER}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Driver: {vehicle.driverName || "Not linked"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Owner UID: {vehicle.ownerUid || "Not linked"}</Text>
              <Text style={[styles.userLine, { color: theme.mutedText }]}>Created: {formatDate(vehicle.createdAt)}</Text>

              <View style={styles.userActions}>
                <TouchableOpacity style={[styles.smallActionButton, styles.editButton]} onPress={() => openVehicleEditor(vehicle)}>
                  <Text style={styles.smallActionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallActionButton, styles.deleteButton]} onPress={() => setConfirmingVehicleDelete(vehicle)}>
                  <Text style={styles.smallActionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No vehicle records found.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>
            {vehiclesError || "Add a city/barangay vehicle or sync approved driver-owned vehicles to populate this section."}
          </Text>
        </View>
      )}

      {vehiclesError ? <Text style={styles.errorText}>{vehiclesError}</Text> : null}
      {vehicleMessage ? <Text style={styles.feedbackText}>{vehicleMessage}</Text> : null}
    </>
  );

  const renderSectionContent = () => {
    if (selectedSection === "Staff Management") {
      return renderStaffManagement();
    }

    if (selectedSection === "Requests") {
      return renderRequests();
    }

    if (selectedSection === "Users") {
      return renderUsers();
    }

    if (selectedSection === "Vehicles") {
      return renderVehicles();
    }

    return renderOverview();
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
          <View style={[styles.layoutRow, compact && styles.layoutRowCompact]}>
            <View style={[styles.sidebar, compact && styles.sidebarCompact, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sidebarTitle, { color: theme.text }]}>Admin Tools</Text>
              <Text style={[styles.sidebarSubtitle, { color: theme.mutedText }]}>Live controls backed by `users`, `transportRequests`, `Driver_Applications`, `driverAssignments`, and `vehicles`.</Text>

              {sideLinks.map((label) => {
                const active = selectedSection === label;

                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.sideBlock, active && styles.sideBlockActive, { backgroundColor: active ? "#06774B" : "#EAF4EF" }]}
                    onPress={() => setSelectedSection(label)}
                  >
                    <Text style={[styles.sideBlockText, { color: active ? "#FFFFFF" : "#214238" }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.mainArea}>
              <View style={styles.topControls}>
                <View style={[styles.searchBar, { backgroundColor: theme.softSurface, borderColor: theme.softSurfaceBorder }]}>
                  <FontAwesome name="search" size={20} color="#335E50" />
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    placeholder="Search current admin section..."
                    placeholderTextColor={theme.subtleText}
                    value={searchValue}
                    onChangeText={setSearchValue}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.filterButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setRangeLabel((current) => (current === "Week" ? "Month" : current === "Month" ? "Year" : "Week"))}
                >
                  <Text style={[styles.filterButtonText, { color: theme.text }]}>{rangeLabel}</Text>
                  <FontAwesome name="chevron-down" size={18} color="#111111" />
                </TouchableOpacity>
              </View>

              <View style={[styles.contentPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>{renderSectionContent()}</View>
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

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Account Status</Text>
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
                    onPress={() => setUserForm((current) => ({ ...current, accountStatus: status }))}
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete User Record</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Remove {confirmingUserDelete ? getUserName(confirmingUserDelete) : "this user"} from the `users` collection? This does not change the Firebase Authentication password.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.secondaryActionButton, styles.confirmButton]} onPress={() => setConfirmingUserDelete(null)}>
                <Text style={styles.secondaryActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryActionButton, styles.confirmButton, savingUser && styles.actionButtonDisabled]} onPress={() => deleteUserRecord(confirmingUserDelete)} disabled={savingUser}>
                <Text style={styles.primaryActionButtonText}>{savingUser ? "Deleting..." : "Delete Record"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(confirmingUserDeactivate)} transparent animationType="fade" onRequestClose={() => setConfirmingUserDeactivate(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.confirmCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Deactivate Account</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Mark {confirmingUserDeactivate ? getUserName(confirmingUserDeactivate) : "this user"} as deactivated?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.secondaryActionButton, styles.confirmButton]} onPress={() => setConfirmingUserDeactivate(null)}>
                <Text style={styles.secondaryActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryActionButton, styles.confirmButton, savingUser && styles.actionButtonDisabled]} onPress={() => deactivateUser(confirmingUserDeactivate)} disabled={savingUser}>
                <Text style={styles.primaryActionButtonText}>{savingUser ? "Saving..." : "Deactivate"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(confirmingVehicleDelete)} transparent animationType="fade" onRequestClose={() => setConfirmingVehicleDelete(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.confirmCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Vehicle Record</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Delete {confirmingVehicleDelete?.name || "this vehicle"} from the `vehicles` collection?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.secondaryActionButton, styles.confirmButton]} onPress={() => setConfirmingVehicleDelete(null)}>
                <Text style={styles.secondaryActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryActionButton, styles.confirmButton, savingVehicle && styles.actionButtonDisabled]} onPress={() => deleteVehicleRecord(confirmingVehicleDelete)} disabled={savingVehicle}>
                <Text style={styles.primaryActionButtonText}>{savingVehicle ? "Deleting..." : "Delete Vehicle"}</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={[styles.profileMenuEmail, { color: theme.secondaryText }]}>{profile?.email || authUser?.email || "Admin account"}</Text>
            </View>

            <View style={styles.profileMenuBody}>
              {menuItems.map((item) => (
                <TouchableOpacity key={item.key} style={styles.menuItem} onPress={item.action}>
                  <View style={styles.menuItemLeft}>
                    <FontAwesome name={item.icon} size={18} color={theme.mutedText} />
                    <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                  </View>
                  {item.key === "profile" ? null : <Text style={[styles.menuItemSoon, { color: theme.secondaryText }]}>Soon</Text>}
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
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
    alignSelf: "flex-start",
  },
  sidebarCompact: {
    width: "100%",
  },
  sidebarTitle: { fontSize: 20, fontWeight: "900" },
  sidebarSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
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
  topControls: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  searchBar: {
    flex: 1,
    minWidth: 260,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterButtonText: { fontSize: 15, fontWeight: "700" },
  contentPanel: { padding: 14, borderRadius: 18, borderWidth: 1 },
  sectionHeader: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "#3F4542" },
  sectionHeaderText: { fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
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
