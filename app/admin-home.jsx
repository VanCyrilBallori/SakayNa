import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import BrandLogo from "../components/BrandLogo";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

const ADMIN_ROLE = "Admin";
const sideLinks = ["Overview", "Verifications", "Requests", "Users", "Vehicles"];
const userRoleFilters = ["All", "Resident", "Driver", "Dispatcher", "Admin", "Pending"];
const requestStatusFilters = ["All", "Pending", "Assigned", "In Progress", "Completed", "Cancelled"];
const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const vehicleRecords = [
  { name: "Toyota HiAce Van", type: "van" },
  { name: "Ambulance", type: "ambulance" },
];

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
    return "Waiting";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getVehicleDetails = (application) => {
  const details = [application.vehicleYear, application.vehicleMake, application.vehicleModel].filter(Boolean).join(" ");
  return details || "Not provided";
};

const getUserPhone = (user) => user.phone ?? user.phoneNumber ?? "Not provided";
const getProfilePhoto = (record) => record.profilePhoto || record.photoURL || record.avatarUrl || "";
const normalizeRole = (role = "") => role.toLowerCase();
const getUserName = (user) => user.fullName || user.displayName || user.email || "Registered User";
const getApprovalStatus = (user) => user.accountStatus || user.approvalStatus || user.status || "Active";
const getSaturdayFirstIndex = (date) => {
  const day = date.getDay();
  return day === 6 ? 0 : day + 1;
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
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const [users, setUsers] = useState([]);
  const [driverApplications, setDriverApplications] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [applicationsMessage, setApplicationsMessage] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
  const [selectedRequestRecord, setSelectedRequestRecord] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [viewedVehicle, setViewedVehicle] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

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
          .sort((first, second) => {
            const firstTime = first.createdAt?.toMillis?.() ?? 0;
            const secondTime = second.createdAt?.toMillis?.() ?? 0;
            return secondTime - firstTime;
          });

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
          .sort((first, second) => {
            const firstTime = first.createdAt?.toMillis?.() ?? 0;
            const secondTime = second.createdAt?.toMillis?.() ?? 0;
            return secondTime - firstTime;
          });

        setTransportRequests(nextRequests);
      },
      (error) => console.log("Transport requests listener warning:", error)
    );

    return () => {
      unsubscribeUsers();
      unsubscribeApplications();
      unsubscribeRequests();
    };
  }, [adminAccessStatus]);

  const pendingApplications = useMemo(
    () => driverApplications.filter((application) => application.status === "Pending"),
    [driverApplications]
  );

  const pendingStaffUsers = useMemo(
    () =>
      users.filter((user) => {
        const role = normalizeRole(user.role);
        const status = getApprovalStatus(user).toLowerCase();
        return role !== "resident" && status === "pending";
      }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return users.filter((user) => {
      const role = user.role || "";
      const status = getApprovalStatus(user);
      const matchesRole =
        userRoleFilter === "All" ||
        role === userRoleFilter ||
        (userRoleFilter === "Pending" && status.toLowerCase() === "pending");
      const matchesSearch =
        !query ||
        getUserName(user).toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.barangay || "").toLowerCase().includes(query) ||
        role.toLowerCase().includes(query);

      return matchesRole && matchesSearch;
    });
  }, [searchValue, userRoleFilter, users]);

  const filteredRequests = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return transportRequests.filter((request) => {
      const requestStatus = request.status || "Pending";
      const matchesStatus = requestStatusFilter === "All" || requestStatus === requestStatusFilter;
      const matchesSearch =
        !query ||
        (request.residentName || "").toLowerCase().includes(query) ||
        (request.emergencyType || "").toLowerCase().includes(query) ||
        (request.pickupLocation || "").toLowerCase().includes(query) ||
        (request.vehicle || request.vehicleType || "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [requestStatusFilter, searchValue, transportRequests]);

  const filteredVehicles = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return vehicleRecords.filter((item) => !query || item.name.toLowerCase().includes(query));
  }, [searchValue]);

  const weeklyActivity = useMemo(() => {
    const values = Array(dayLabels.length).fill(0);
    const records = [
      ...users.map((item) => item.createdAt),
      ...driverApplications.map((item) => item.createdAt),
      ...transportRequests.map((item) => item.createdAt),
    ];

    records.forEach((value) => {
      const date = getDateFromValue(value);

      if (date) {
        values[getSaturdayFirstIndex(date)] += 1;
      }
    });

    return values;
  }, [driverApplications, transportRequests, users]);

  const maxActivity = Math.max(...weeklyActivity, 1);
  const overviewMetrics = [
    { label: "Residents", value: users.filter((user) => normalizeRole(user.role) === "resident").length },
    { label: "Drivers", value: users.filter((user) => normalizeRole(user.role) === "driver").length },
    { label: "Dispatchers", value: users.filter((user) => normalizeRole(user.role) === "dispatcher").length },
    { label: "Pending Requests", value: transportRequests.filter((request) => request.status === "Pending").length },
  ];

  const notifications = [
    `${pendingApplications.length} driver ${pendingApplications.length === 1 ? "application" : "applications"} waiting for review.`,
    `${pendingStaffUsers.length} staff ${pendingStaffUsers.length === 1 ? "account" : "accounts"} pending approval.`,
    `${transportRequests.filter((request) => request.status === "Pending").length} transport requests are still pending.`,
  ];

  const requestStatusStats = requestStatusFilters
    .filter((status) => status !== "All")
    .map((status) => ({ label: status, value: transportRequests.filter((request) => (request.status || "Pending") === status).length }));

  const menuItems = [
    { key: "profile", label: "Profile", icon: "user", action: () => { setProfileMenuOpen(false); setProfileEditorOpen(true); } },
    { key: "history", label: "History", icon: "clock", action: () => {} },
    { key: "settings", label: "Settings", icon: "settings", action: () => {} },
  ];

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
    setApplicationsMessage("");
    setUpdatingApplicationId(application.id);

    try {
      const batch = writeBatch(db);
      const statusTimestamp = status === "Approved" ? { approvedAt: serverTimestamp() } : { rejectedAt: serverTimestamp() };

      batch.update(doc(db, "Driver_Applications", application.id), {
        status,
        ...statusTimestamp,
      });

      batch.update(doc(db, "users", application.driverUid), {
        accountStatus: status,
        ...statusTimestamp,
      });

      await batch.commit();
      setApplicationsMessage(`Application ${status.toLowerCase()} successfully.`);
    } catch (error) {
      console.log("Driver application status update failed:", error);
      setApplicationsError("Application status could not be updated. Please check Firestore permissions.");
    } finally {
      setUpdatingApplicationId("");
    }
  };

  const updateStaffStatus = async (user, status) => {
    if (!user?.id) {
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.id), {
        accountStatus: status,
        updatedAt: serverTimestamp(),
        ...(status === "Approved" ? { approvedAt: serverTimestamp() } : { rejectedAt: serverTimestamp() }),
      });
    } catch (error) {
      console.log("Staff approval update failed:", error);
      setApplicationsError("Staff account status could not be updated. Please check Firestore permissions.");
    }
  };

  const renderOverview = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Overview</Text>
      </View>

      <View style={[styles.notificationPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.notificationHeader}>
          <Feather name="bell" size={18} color="#06774B" />
          <Text style={[styles.notificationTitle, { color: theme.text }]}>Admin Summary</Text>
        </View>
        {notifications.map((note) => (
          <Text key={note} style={[styles.notificationText, { color: theme.mutedText }]}>{note}</Text>
        ))}
      </View>

      <View style={styles.metricsGrid}>
        {overviewMetrics.map((metric) => (
          <View key={metric.label} style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>{metric.label}</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.chartCard, { backgroundColor: theme.softSurface, borderColor: theme.softSurfaceBorder }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Weekly Activity</Text>
            <Text style={[styles.chartSubtitle, { color: theme.mutedText }]}>Accounts, requests, and applications received this week.</Text>
          </View>
          <TouchableOpacity
            style={[styles.rangeButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setRangeLabel((current) => (current === "Week" ? "Month" : current === "Month" ? "Year" : "Week"))}
          >
            <Text style={[styles.rangeButtonText, { color: theme.text }]}>{rangeLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.barRow}>
          {weeklyActivity.map((value, index) => {
            const ratio = maxActivity ? value / maxActivity : 0;

            return (
              <View key={dayLabels[index]} style={styles.barItem}>
                <Text style={[styles.barValue, { color: theme.text }]}>{value}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
                  <View style={[styles.bar, { height: Math.max(16, 132 * ratio), backgroundColor: index === 2 ? "#06774B" : "#08A967" }]} />
                </View>
                <Text style={[index === 2 ? styles.dayTextActive : styles.dayText, { color: index === 2 ? "#FFFFFF" : theme.text, backgroundColor: index === 2 ? "#06774B" : "transparent" }]}>
                  {dayLabels[index]}
                </Text>
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

        <View style={[styles.statsPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statsPanelTitle, { color: theme.text }]}>Quick Counts</Text>
          <View style={styles.quickStatsGrid}>
            <View style={[styles.quickStatCard, { backgroundColor: theme.emergencyCard }]}>
              <Text style={[styles.quickStatValue, { color: theme.text }]}>{pendingApplications.length}</Text>
              <Text style={[styles.quickStatLabel, { color: theme.mutedText }]}>Driver Verifications</Text>
            </View>
            <View style={[styles.quickStatCard, { backgroundColor: theme.transportCard }]}>
              <Text style={[styles.quickStatValue, { color: theme.text }]}>{pendingStaffUsers.length}</Text>
              <Text style={[styles.quickStatLabel, { color: theme.mutedText }]}>Pending Staff</Text>
            </View>
            <View style={[styles.quickStatCard, { backgroundColor: theme.statusCard }]}>
              <Text style={[styles.quickStatValue, { color: theme.text }]}>{vehicleRecords.length}</Text>
              <Text style={[styles.quickStatLabel, { color: theme.mutedText }]}>Vehicles</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  const renderVerifications = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Verifications</Text>
      </View>

      <View style={styles.verificationSection}>
        <Text style={[styles.subsectionTitle, { color: theme.text }]}>Driver Applications</Text>
        {isLoadingApplications ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator color="#06774B" />
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading pending driver applications...</Text>
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
                  <Text style={[styles.verifyDetail, { color: theme.text }]}>Vehicle: {getVehicleDetails(application)}</Text>
                  <Text style={[styles.verifyDetail, { color: theme.mutedText }]}>Applied: {formatDate(application.createdAt)}</Text>

                  {application.uploaded_document ? (
                    <TouchableOpacity style={styles.documentPreviewWrap} onPress={() => setPreviewImageUrl(application.uploaded_document)}>
                      <Image source={{ uri: application.uploaded_document }} style={styles.documentImage} />
                    </TouchableOpacity>
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
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>New driver applications will appear here for review.</Text>
          </View>
        )}
      </View>

      <View style={styles.verificationSection}>
        <Text style={[styles.subsectionTitle, { color: theme.text }]}>Pending Staff Accounts</Text>
        {pendingStaffUsers.length ? (
          <View style={styles.verificationGrid}>
            {pendingStaffUsers.map((user) => (
              <View key={user.id} style={[styles.verificationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.verificationTop}>
                  <View style={styles.verifyIdentity}>
                    <View style={[styles.verifyAvatar, { backgroundColor: theme.avatarBg }]}>
                      <FontAwesome name="user" size={22} color={theme.avatarText} />
                    </View>
                    <View style={styles.verifyIdentityCopy}>
                      <Text style={[styles.verifyName, { color: theme.text }]}>{getUserName(user)}</Text>
                      <Text style={[styles.verifyMeta, { color: theme.mutedText }]}>{user.role || "No role"}</Text>
                    </View>
                  </View>
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>Pending</Text>
                  </View>
                </View>

                <Text style={[styles.verifyDetail, { color: theme.text }]}>Email: {user.email || "Not provided"}</Text>
                <Text style={[styles.verifyDetail, { color: theme.text }]}>Phone: {getUserPhone(user)}</Text>
                <Text style={[styles.verifyDetail, { color: theme.text }]}>Barangay: {user.barangay || "Not provided"}</Text>
                <Text style={[styles.verifyDetail, { color: theme.mutedText }]}>Created: {formatDate(user.createdAt)}</Text>

                <View style={styles.verifyActions}>
                  <TouchableOpacity style={[styles.verifyButton, styles.rejectButton]} onPress={() => updateStaffStatus(user, "Rejected")}>
                    <Text style={styles.verifyButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.verifyButton, styles.approveButton]} onPress={() => updateStaffStatus(user, "Approved")}>
                    <Text style={styles.verifyButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending dispatcher or staff accounts</Text>
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>Assigned staff accounts waiting for approval will show here.</Text>
          </View>
        )}
      </View>

      {applicationsError ? <Text style={styles.errorText}>{applicationsError}</Text> : null}
      {applicationsMessage ? <Text style={styles.feedbackText}>{applicationsMessage}</Text> : null}
    </>
  );

  const renderRequests = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Requests</Text>
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

      {filteredRequests.length ? (
        <View style={styles.requestGrid}>
          {filteredRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setSelectedRequestRecord(request)}
            >
              <View style={styles.requestCardTop}>
                <View style={[styles.requestLevelPill, { backgroundColor: request.level === "Emergency" ? "#FAD9D9" : request.level === "Urgent" ? "#FFF1CB" : "#DDF2E6" }]}>
                  <Text style={styles.requestLevelText}>{request.level || request.priorityLevel || "Pending"}</Text>
                </View>
                <Text style={[styles.requestStatusText, { color: theme.mutedText }]}>{request.status || "Pending"}</Text>
              </View>

              <Text style={[styles.requestTitle, { color: theme.text }]}>{request.emergencyType || request.title || "Transport Request"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Resident: {request.residentName || "Resident"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Vehicle: {request.vehicle || request.vehicleType || "Available vehicle"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Pickup: {request.pickupLocation || request.barangay || "Pickup pending"}</Text>

              <TouchableOpacity style={styles.requestViewButton} onPress={() => setSelectedRequestRecord(request)}>
                <Text style={styles.requestViewButtonText}>View Details</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No request records found yet.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Transport requests will appear here once residents submit them.</Text>
        </View>
      )}
    </>
  );

  const renderUsers = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Users</Text>
      </View>

      <View style={styles.filterRow}>
        {userRoleFilters.map((role) => {
          const active = userRoleFilter === role;

          return (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface },
              ]}
              onPress={() => setUserRoleFilter(role)}
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
                    {getProfilePhoto(user) ? <Image source={{ uri: getProfilePhoto(user) }} style={styles.avatarImage} /> : <FontAwesome name="user" size={22} color={theme.avatarText} />}
                  </View>
                  <View style={styles.userIdentityCopy}>
                    <Text style={[styles.userName, { color: theme.text }]}>{getUserName(user)}</Text>
                    <Text style={[styles.userRole, { color: theme.mutedText }]}>{user.role || "No role"}</Text>
                  </View>
                </View>
                <View style={[styles.userStatusPill, { backgroundColor: getApprovalStatus(user).toLowerCase() === "approved" ? "#DDF2E6" : "#FFF1CB" }]}>
                  <Text style={styles.userStatusText}>{getApprovalStatus(user)}</Text>
                </View>
              </View>

              <Text style={[styles.userLine, { color: theme.text }]}>Email: {user.email || "Not provided"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Phone: {getUserPhone(user)}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Barangay: {user.barangay || "Not provided"}</Text>
              <Text style={[styles.userLine, { color: theme.mutedText }]}>Created: {formatDate(user.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No users match the selected filter.</Text>
          {usersError ? <Text style={[styles.emptyText, { color: theme.mutedText }]}>{usersError}</Text> : null}
        </View>
      )}
    </>
  );

  const renderVehicles = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Vehicles</Text>
      </View>

      <View style={styles.vehicleRow}>
        {filteredVehicles.map((vehicle) => (
          <View key={vehicle.name} style={[styles.vehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.vehicleTitle, { color: theme.text }]}>{vehicle.name}</Text>
            <Text style={[styles.vehicleMeta, { color: theme.mutedText }]}>{vehicle.type === "ambulance" ? "Emergency vehicle" : "Transport vehicle"}</Text>
            <View style={[styles.vehicleImageWrap, { backgroundColor: theme.softSurface }]}>
              {vehicle.type === "ambulance" ? (
                <FontAwesome name="ambulance" size={120} color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="van-passenger" size={130} color="#FFFFFF" />
              )}
            </View>
            <TouchableOpacity style={styles.vehicleButton} onPress={() => setViewedVehicle(vehicle.name)}>
              <Text style={styles.vehicleButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {viewedVehicle ? <Text style={styles.feedbackText}>Viewing vehicle record for {viewedVehicle}.</Text> : null}
    </>
  );

  const renderSectionContent = () => {
    if (selectedSection === "Verifications") {
      return renderVerifications();
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
              <Text style={[styles.sidebarSubtitle, { color: theme.mutedText }]}>Core controls from the main system, arranged in the cleaner reference layout.</Text>

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
                  <Feather name="search" size={20} color="#335E50" />
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    placeholder="Search admin data..."
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
                  <Feather name="chevron-down" size={18} color="#111111" />
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
                <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedRequestRecord?.emergencyType || "Request Details"}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>{selectedRequestRecord?.status || "Pending"} transport request.</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedRequestRecord(null)}>
                <Feather name="x" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={[styles.detailBox, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.detailLine, { color: theme.text }]}>Resident: {selectedRequestRecord?.residentName || "Resident"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Priority: {selectedRequestRecord?.priorityLevel || selectedRequestRecord?.level || "Normal"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Pickup: {selectedRequestRecord?.pickupLocation || selectedRequestRecord?.barangay || "Pickup pending"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Exact pickup: {selectedRequestRecord?.pickupDetails || "No exact pickup details saved"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Condition: {selectedRequestRecord?.patientCondition || "Not specified"}</Text>
              {selectedRequestRecord?.additionalNotes ? <Text style={[styles.detailLine, { color: theme.text }]}>Notes: {selectedRequestRecord.additionalNotes}</Text> : null}
              <Text style={[styles.detailLine, { color: theme.text }]}>Vehicle: {selectedRequestRecord?.vehicle || selectedRequestRecord?.vehicleType || "Vehicle pending"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Driver: {selectedRequestRecord?.assignedDriverName || "Unassigned"}</Text>
              <Text style={[styles.detailLine, { color: theme.text }]}>Created: {formatDateTime(selectedRequestRecord?.createdAt)}</Text>
            </View>
          </ScrollView>
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
                    <Feather name={item.icon} size={18} color={theme.mutedText} />
                    <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                  </View>
                  {item.key === "profile" ? null : <Text style={[styles.menuItemSoon, { color: theme.secondaryText }]}>Soon</Text>}
                </TouchableOpacity>
              ))}

              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Feather name={theme.mode === "Dark" ? "moon" : "sun"} size={18} color={theme.mutedText} />
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
                router.replace("/");
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
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>You can prepare your profile details here. Save/edit functions are not connected yet.</Text>

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Full name"
              placeholderTextColor={theme.subtleText}
              defaultValue={profile?.fullName || displayName}
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Phone number"
              placeholderTextColor={theme.subtleText}
              defaultValue={profile?.phoneNumber || ""}
              keyboardType="phone-pad"
            />

            <Text style={[styles.profileFieldLabel, { color: theme.text }]}>Barangay</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Barangay"
              placeholderTextColor={theme.subtleText}
              defaultValue={profile?.barangay || TOLEDO_BARANGAY_OPTIONS[0]?.label || ""}
            />

            <TouchableOpacity style={[styles.disabledSaveButton, { backgroundColor: theme.disabledButtonBg }]} activeOpacity={1}>
              <Text style={[styles.disabledSaveButtonText, { color: theme.disabledButtonText }]}>Save Changes Soon</Text>
            </TouchableOpacity>
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
  dayTextActive: { marginTop: 10, fontSize: 11, fontWeight: "800", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 },
  statsPanel: { flexGrow: 1, flexBasis: 260, padding: 18, borderRadius: 16, borderWidth: 1 },
  statsPanelTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },
  statLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(127,127,127,0.18)" },
  statLineLabel: { flex: 1, fontSize: 13, fontWeight: "700" },
  statLineValue: { fontSize: 15, fontWeight: "900" },
  quickStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickStatCard: { flexGrow: 1, flexBasis: 120, padding: 14, borderRadius: 12 },
  quickStatValue: { fontSize: 24, fontWeight: "900" },
  quickStatLabel: { marginTop: 4, fontSize: 12, fontWeight: "700" },
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
  documentPreviewWrap: { marginTop: 14, alignSelf: "flex-start" },
  documentImage: { width: 104, height: 70, borderRadius: 10, backgroundColor: "#EAF2EE" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 12 },
  filterChip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: "800" },
  requestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  requestCard: { flexGrow: 1, flexBasis: 280, padding: 18, borderRadius: 14, borderWidth: 1 },
  requestCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  requestLevelPill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999 },
  requestLevelText: { fontSize: 12, fontWeight: "900", color: "#111111" },
  requestStatusText: { fontSize: 12, fontWeight: "800" },
  requestTitle: { marginTop: 14, fontSize: 20, fontWeight: "900" },
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
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 14 },
  vehicleCard: { flexGrow: 1, flexBasis: 320, maxWidth: 420, padding: 18, borderRadius: 16, borderWidth: 1 },
  vehicleTitle: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  vehicleMeta: { marginTop: 8, fontSize: 14, fontWeight: "800", textAlign: "center" },
  vehicleImageWrap: { width: "100%", minHeight: 170, marginTop: 18, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  vehicleButton: { width: "58%", marginTop: 18, paddingVertical: 16, borderRadius: 999, backgroundColor: "#06774B", alignItems: "center", alignSelf: "center" },
  vehicleButtonText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  emptyState: { marginTop: 14, padding: 18, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyText: { marginTop: 2, fontSize: 13, lineHeight: 19, textAlign: "center" },
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
  disabledSaveButton: { marginTop: 28, minHeight: 52, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#CFD8D3" },
  disabledSaveButtonText: { fontSize: 15, fontWeight: "800", color: "#466157" },
  imageModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  imageModalCloseArea: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  imageModalPreview: { width: "100%", height: "84%" },
  imageModalCloseText: { marginTop: 12, fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  feedbackText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#335E50" },
  errorText: { marginTop: 16, fontSize: 15, fontWeight: "700", color: "#B42318" },
});
