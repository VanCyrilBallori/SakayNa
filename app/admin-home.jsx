import { useRouter } from "expo-router";
import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { auth, db } from "../firebase";
import { useCurrentUserProfile } from "../lib/session";

const sideLinks = ["City Dashboard", "Residents", "Drivers", "Dispatchers", "Vehicles"];
const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const ADMIN_ROLE = "Admin";
const vehicleRecords = [
  { name: "Toyota HiAce Van", type: "van" },
  { name: "Ambulance", type: "ambulance" },
];

const formatDate = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getVehicleDetails = (application) => {
  const details = [application.vehicleYear, application.vehicleMake, application.vehicleModel].filter(Boolean).join(" ");
  return details || "Not provided";
};

const getUserVehicleDetails = (user) => {
  const details = [user.vehicleYear, user.vehicleMake, user.vehicleModel].filter(Boolean).join(" ");
  return details || "Not provided";
};

const getUserPhone = (user) => user.phone ?? user.phoneNumber ?? "Not provided";

const getProfilePhoto = (record) => record.profilePhoto || record.photoURL || record.avatarUrl || "";

export default function AdminHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1080;
  const { displayName } = useCurrentUserProfile();
  const [adminAccessStatus, setAdminAccessStatus] = useState("checking");
  const [selectedSection, setSelectedSection] = useState("City Dashboard");
  const [searchValue, setSearchValue] = useState("");
  const [rangeLabel, setRangeLabel] = useState("Week");
  const [viewedVehicle, setViewedVehicle] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [driverApplications, setDriverApplications] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
  const [applicationsMessage, setApplicationsMessage] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");

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

    const unsubscribe = onSnapshot(
      collection(db, "Driver_Applications"),
      (snapshot) => {
        const nextApplications = snapshot.docs
          .map((applicationDoc) => ({
            id: applicationDoc.id,
            ...applicationDoc.data(),
          }))
          .sort((first, second) => {
            const firstDate = first.createdAt?.toMillis?.() ?? 0;
            const secondDate = second.createdAt?.toMillis?.() ?? 0;
            return secondDate - firstDate;
          });

        setDriverApplications(nextApplications);
        setPendingApplications(nextApplications.filter((application) => application.status === "Pending"));
        setIsLoadingApplications(false);
        setApplicationsError("");
      },
      (error) => {
        console.log("Driver applications listener warning:", error);
        setApplicationsError("Driver applications could not be loaded. Please check Firestore permissions.");
        setIsLoadingApplications(false);
      }
    );

    return unsubscribe;
  }, [adminAccessStatus]);

  useEffect(() => {
    if (adminAccessStatus !== "authorized") {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextUsers = snapshot.docs.map((userDoc) => ({
          id: userDoc.id,
          ...userDoc.data(),
        }));

        setUsers(nextUsers);
        setIsLoadingUsers(false);
        setUsersError("");
      },
      (error) => {
        console.log("Users listener warning:", error);
        setUsersError("Users could not be loaded. Please check Firestore permissions.");
        setIsLoadingUsers(false);
      }
    );

    return unsubscribe;
  }, [adminAccessStatus]);

  const residentUsers = useMemo(() => users.filter((user) => user.role === "Resident"), [users]);
  const driverUsers = useMemo(() => users.filter((user) => user.role === "Driver"), [users]);
  const dispatcherUsers = useMemo(() => users.filter((user) => user.role === "Dispatcher"), [users]);

  const filteredResidents = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return residentUsers.filter((item) => {
      if (!query) {
        return true;
      }

      return (
        item.fullName?.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        getUserPhone(item).toLowerCase().includes(query)
      );
    });
  }, [residentUsers, searchValue]);

  const filteredDrivers = useMemo(() => {
    const searchQuery = searchValue.trim().toLowerCase();

    return driverUsers.filter((item) => {
      if (!searchQuery) {
        return true;
      }

      return (
        item.fullName?.toLowerCase().includes(searchQuery) ||
        item.email?.toLowerCase().includes(searchQuery) ||
        getUserPhone(item).toLowerCase().includes(searchQuery) ||
        item.accountStatus?.toLowerCase().includes(searchQuery) ||
        getUserVehicleDetails(item).toLowerCase().includes(searchQuery)
      );
    });
  }, [driverUsers, searchValue]);

  const getDriverVehicleDetails = (driver) => {
    const driverApplication = driverApplications.find((application) => application.driverUid === driver.uid || application.driverUid === driver.id);
    return getUserVehicleDetails(driver) !== "Not provided" ? getUserVehicleDetails(driver) : getVehicleDetails(driverApplication ?? {});
  };

  const filteredDispatchers = useMemo(() => {
    const searchQuery = searchValue.trim().toLowerCase();

    return dispatcherUsers.filter((item) => {
      if (!searchQuery) {
        return true;
      }

      return item.fullName?.toLowerCase().includes(searchQuery) || item.email?.toLowerCase().includes(searchQuery);
    });
  }, [dispatcherUsers, searchValue]);

  const filteredApplications = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return pendingApplications.filter((item) => {
      if (!query) {
        return true;
      }

      return (
        item.fullName?.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        item.phone?.toLowerCase().includes(query) ||
        item.licenseNumber?.toLowerCase().includes(query) ||
        getVehicleDetails(item).toLowerCase().includes(query)
      );
    });
  }, [pendingApplications, searchValue]);

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

  const filteredVehicles = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return vehicleRecords.filter((item) => {
      if (!query) {
        return true;
      }

      return item.name.toLowerCase().includes(query);
    });
  }, [searchValue]);


  const renderDashboard = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Dashboard Overview</Text>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartTabs}>
          <Text style={[styles.chartTab, styles.chartTabActive]}>Requests</Text>
          <Text style={styles.chartTab}>Actions</Text>
          <Text style={styles.chartTab}>Active Vehicles</Text>
        </View>

        <View style={styles.chartArea}>
          <View style={styles.chartShapeA} />
          <View style={styles.chartShapeB} />
          <View style={styles.chartMarkerLine} />
          <View style={styles.chartMarkerDot} />
        </View>

        <View style={styles.daysRow}>
          {dayLabels.map((day) => (
            <View key={day} style={day === "Mon" ? styles.dayPillActive : styles.dayWrap}>
              <Text style={day === "Mon" ? styles.dayTextActive : styles.dayText}>{day}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  const renderResidents = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Resident Management</Text>
      </View>

      <View style={styles.tableCard}>
        {isLoadingUsers ? (
          <View style={styles.tableState}>
            <ActivityIndicator color="#0B8E59" />
            <Text style={styles.tableStateText}>Loading residents...</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.usersTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.photoCol]}>Profile Photo</Text>
                <Text style={[styles.tableHeaderCell, styles.nameCol]}>Full Name</Text>
                <Text style={[styles.tableHeaderCell, styles.emailCol]}>Email</Text>
                <Text style={[styles.tableHeaderCell, styles.phoneCol]}>Phone</Text>
                <Text style={[styles.tableHeaderCell, styles.statusCol]}>Status</Text>
                <Text style={[styles.tableHeaderCell, styles.dateAppliedCol]}>Registration Date</Text>
              </View>

              {filteredResidents.length ? (
                filteredResidents.map((resident) => (
                  <View key={resident.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.photoCol]}>
                      {getProfilePhoto(resident) ? <Image source={{ uri: getProfilePhoto(resident) }} style={styles.avatarImage} /> : <FontAwesome name="user" size={24} color="#66776F" />}
                    </View>
                    <Text style={[styles.tableCellStrong, styles.nameCol]}>{resident.fullName || "Not provided"}</Text>
                    <Text style={[styles.tableCell, styles.emailCol]}>{resident.email || "Not provided"}</Text>
                    <Text style={[styles.tableCell, styles.phoneCol]}>{getUserPhone(resident)}</Text>
                    <Text style={[styles.tableCell, styles.statusCol]}>{resident.accountStatus || "Active"}</Text>
                    <Text style={[styles.tableCell, styles.dateAppliedCol]}>{formatDate(resident.createdAt)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.tableState}>
                  <Text style={styles.tableStateTitle}>No Residents Found</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
      {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
    </>
  );

  const renderDrivers = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Pending Driver Applications</Text>
      </View>

      <View style={styles.tableCard}>
        {isLoadingApplications ? (
          <View style={styles.tableState}>
            <ActivityIndicator color="#0B8E59" />
            <Text style={styles.tableStateText}>Loading pending applications...</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.applicationsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.photoCol]}>Applicant Photo</Text>
                <Text style={[styles.tableHeaderCell, styles.applicantCol]}>Applicant Name</Text>
                <Text style={[styles.tableHeaderCell, styles.emailCol]}>Email</Text>
                <Text style={[styles.tableHeaderCell, styles.phoneCol]}>Phone</Text>
                <Text style={[styles.tableHeaderCell, styles.licenseCol]}>License Number</Text>
                <Text style={[styles.tableHeaderCell, styles.vehicleDetailsCol]}>Vehicle</Text>
                <Text style={[styles.tableHeaderCell, styles.documentCol]}>Uploaded Document</Text>
                <Text style={[styles.tableHeaderCell, styles.dateAppliedCol]}>Date Applied</Text>
                <Text style={[styles.tableHeaderCell, styles.actionsCol]}>Actions</Text>
              </View>

              {filteredApplications.length ? (
                filteredApplications.map((application) => {
                  const isUpdating = updatingApplicationId === application.id;

                  return (
                    <View key={application.id} style={styles.tableRow}>
                      <View style={[styles.tableCell, styles.photoCol]}>
                        <FontAwesome name="user" size={24} color="#66776F" />
                      </View>
                      <Text style={[styles.tableCellStrong, styles.applicantCol]}>{application.fullName || "Not provided"}</Text>
                      <Text style={[styles.tableCell, styles.emailCol]}>{application.email || "Not provided"}</Text>
                      <Text style={[styles.tableCell, styles.phoneCol]}>{application.phone || "Not provided"}</Text>
                      <Text style={[styles.tableCell, styles.licenseCol]}>{application.licenseNumber || "Not provided"}</Text>
                      <Text style={[styles.tableCell, styles.vehicleDetailsCol]}>{getVehicleDetails(application)}</Text>
                      <View style={[styles.tableCell, styles.documentCol]}>
                        {application.uploaded_document ? (
                          <TouchableOpacity onPress={() => setPreviewImageUrl(application.uploaded_document)}>
                            <Image source={{ uri: application.uploaded_document }} style={styles.documentImage} />
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tableMutedText}>No image</Text>
                        )}
                      </View>
                      <Text style={[styles.tableCell, styles.dateAppliedCol]}>{formatDate(application.createdAt)}</Text>
                      <View style={[styles.tableCell, styles.actionsCol, styles.actionsCell]}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.approveButton, isUpdating && styles.actionButtonDisabled]}
                          onPress={() => updateApplicationStatus(application, "Approved")}
                          disabled={isUpdating}
                        >
                          <Text style={styles.actionButtonText}>{isUpdating ? "Saving..." : "Approve"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.rejectButton, isUpdating && styles.actionButtonDisabled]}
                          onPress={() => updateApplicationStatus(application, "Rejected")}
                          disabled={isUpdating}
                        >
                          <Text style={styles.actionButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.tableState}>
                  <Text style={styles.tableStateTitle}>No pending applications</Text>
                  <Text style={styles.tableStateText}>New driver applications will appear here for review.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {applicationsError ? <Text style={styles.errorText}>{applicationsError}</Text> : null}
      {applicationsMessage ? <Text style={styles.feedbackText}>{applicationsMessage}</Text> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Driver Accounts</Text>
      </View>

      <View style={styles.tableCard}>
        {isLoadingUsers ? (
          <View style={styles.tableState}>
            <ActivityIndicator color="#0B8E59" />
            <Text style={styles.tableStateText}>Loading drivers...</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.usersTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.photoCol]}>Profile Photo</Text>
                <Text style={[styles.tableHeaderCell, styles.nameCol]}>Full Name</Text>
                <Text style={[styles.tableHeaderCell, styles.emailCol]}>Email</Text>
                <Text style={[styles.tableHeaderCell, styles.phoneCol]}>Phone</Text>
                <Text style={[styles.tableHeaderCell, styles.statusCol]}>Account Status</Text>
                <Text style={[styles.tableHeaderCell, styles.dateAppliedCol]}>Approved Date</Text>
                <Text style={[styles.tableHeaderCell, styles.vehicleDetailsCol]}>Vehicle</Text>
              </View>

              {filteredDrivers.length ? (
                filteredDrivers.map((driver) => (
                  <View key={driver.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.photoCol]}>
                      {getProfilePhoto(driver) ? <Image source={{ uri: getProfilePhoto(driver) }} style={styles.avatarImage} /> : <FontAwesome name="user" size={24} color="#66776F" />}
                    </View>
                    <Text style={[styles.tableCellStrong, styles.nameCol]}>{driver.fullName || "Not provided"}</Text>
                    <Text style={[styles.tableCell, styles.emailCol]}>{driver.email || "Not provided"}</Text>
                    <Text style={[styles.tableCell, styles.phoneCol]}>{getUserPhone(driver)}</Text>
                    <Text style={[styles.tableCell, styles.statusCol]}>{driver.accountStatus || "Pending"}</Text>
                    <Text style={[styles.tableCell, styles.dateAppliedCol]}>{formatDate(driver.approvedAt)}</Text>
                    <Text style={[styles.tableCell, styles.vehicleDetailsCol]}>{getDriverVehicleDetails(driver)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.tableState}>
                  <Text style={styles.tableStateTitle}>No Drivers Found</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
      {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
    </>
  );

  const renderDispatchers = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Dispatchers</Text>
      </View>

      <View style={styles.tableCard}>
        {isLoadingUsers ? (
          <View style={styles.tableState}>
            <ActivityIndicator color="#0B8E59" />
            <Text style={styles.tableStateText}>Loading dispatchers...</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.usersTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.photoCol]}>Profile</Text>
                <Text style={[styles.tableHeaderCell, styles.nameCol]}>Name</Text>
                <Text style={[styles.tableHeaderCell, styles.emailCol]}>Email</Text>
                <Text style={[styles.tableHeaderCell, styles.statusCol]}>Status</Text>
                <Text style={[styles.tableHeaderCell, styles.dateAppliedCol]}>Created Date</Text>
              </View>

              {filteredDispatchers.length ? (
                filteredDispatchers.map((dispatcher) => (
                  <View key={dispatcher.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.photoCol]}>
                      {getProfilePhoto(dispatcher) ? <Image source={{ uri: getProfilePhoto(dispatcher) }} style={styles.avatarImage} /> : <FontAwesome name="user" size={24} color="#66776F" />}
                    </View>
                    <Text style={[styles.tableCellStrong, styles.nameCol]}>{dispatcher.fullName || "Not provided"}</Text>
                    <Text style={[styles.tableCell, styles.emailCol]}>{dispatcher.email || "Not provided"}</Text>
                    <Text style={[styles.tableCell, styles.statusCol]}>{dispatcher.accountStatus || "Active"}</Text>
                    <Text style={[styles.tableCell, styles.dateAppliedCol]}>{formatDate(dispatcher.createdAt)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.tableState}>
                  <Text style={styles.tableStateTitle}>No Dispatchers Found</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
    </>
  );

  const renderVehicles = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Vehicles</Text>
      </View>

      <View style={styles.vehicleRow}>
        {filteredVehicles.map((vehicle) => (
          <View key={vehicle.name} style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>{vehicle.name}</Text>
            <View style={styles.vehicleImageWrap}>
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
    if (selectedSection === "Residents") {
      return renderResidents();
    }

    if (selectedSection === "Drivers") {
      return renderDrivers();
    }

    if (selectedSection === "Dispatchers") {
      return renderDispatchers();
    }

    if (selectedSection === "Vehicles") {
      return renderVehicles();
    }

    return renderDashboard();
  };

  if (adminAccessStatus !== "authorized") {
    return (
      <View style={styles.accessPage}>
        <ActivityIndicator color="#0B8E59" />
        <Text style={styles.accessText}>Checking admin access...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppBrandHeader role="Admin" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.layoutRow}>
          <View style={styles.sidebar}>
            {sideLinks.map((label) => (
              <TouchableOpacity
                key={label}
                style={[styles.sideBlock, selectedSection === label && styles.sideBlockActive]}
                onPress={() => setSelectedSection(label)}
              >
                <Text style={styles.sideBlockText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.mainArea}>
            <View style={styles.topControls}>
              <View style={styles.searchBar}>
                <Feather name="search" size={20} color="#335E50" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search dashboard..."
                  placeholderTextColor="#7D9086"
                  value={searchValue}
                  onChangeText={setSearchValue}
                />
              </View>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={() =>
                  setRangeLabel((current) => (current === "Week" ? "Month" : current === "Month" ? "Year" : "Week"))
                }
              >
                <Text style={styles.filterButtonText}>{rangeLabel}</Text>
                <Feather name="chevron-down" size={18} color="#111111" />
              </TouchableOpacity>
            </View>

            {renderSectionContent()}
          </View>
        </View>
      </View>
      <Modal visible={Boolean(previewImageUrl)} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl("")}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalCloseArea} onPress={() => setPreviewImageUrl("")}>
            <Image source={{ uri: previewImageUrl }} style={styles.imageModalPreview} resizeMode="contain" />
            <Text style={styles.imageModalCloseText}>Tap anywhere to close</Text>
          </TouchableOpacity>
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
  container: { width: "100%", maxWidth: 1460, alignSelf: "center", padding: 24 },
  containerCompact: { padding: 16 },
  layoutRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, alignItems: "flex-start" },
  sidebar: { width: 250, gap: 14 },
  sideBlock: { paddingVertical: 28, paddingHorizontal: 18, borderRadius: 6, backgroundColor: "#08A967" },
  sideBlockActive: { backgroundColor: "#06774B" },
  sideBlockText: { fontSize: 17, fontWeight: "800", color: "#0C1612", textAlign: "center" },
  mainArea: { flex: 1, minWidth: 300, gap: 14 },
  topControls: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  searchBar: {
    flex: 1,
    minWidth: 260,
    height: 54,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#06774B",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#214238",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E2DC",
  },
  filterButtonText: { fontSize: 15, fontWeight: "700", color: "#111111" },
  sectionHeader: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 0, backgroundColor: "#4B4B4B" },
  sectionHeaderText: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", fontStyle: "italic" },
  chartCard: { padding: 20, borderRadius: 24, backgroundColor: "#08A967" },
  chartTabs: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  chartTab: { fontSize: 16, fontWeight: "700", color: "#D7FFF0" },
  chartTabActive: { textDecorationLine: "underline", color: "#FFFFFF" },
  chartArea: { height: 260, marginTop: 18, borderRadius: 24, overflow: "hidden", position: "relative", backgroundColor: "rgba(255,255,255,0.14)" },
  chartShapeA: { position: "absolute", left: 0, right: 0, bottom: 0, height: 190, backgroundColor: "rgba(255,255,255,0.65)", borderTopLeftRadius: 160, borderTopRightRadius: 160 },
  chartShapeB: { position: "absolute", left: "30%", right: -30, top: 46, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)", borderTopLeftRadius: 180, borderTopRightRadius: 120 },
  chartMarkerLine: { position: "absolute", left: "42%", top: 24, bottom: 18, width: 3, backgroundColor: "#0B8E59" },
  chartMarkerDot: { position: "absolute", left: "41.4%", top: 20, width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#0B8E59" },
  daysRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginTop: 16, gap: 8 },
  dayWrap: { paddingVertical: 6, paddingHorizontal: 10 },
  dayPillActive: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#0AA866" },
  dayText: { fontSize: 15, fontWeight: "700", color: "#0F1F19" },
  dayTextActive: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  tableCard: { borderWidth: 1, borderColor: "#1B1B1B", backgroundColor: "#FFFFFF" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0B8E59" },
  tableHeaderCell: { paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, fontWeight: "700", color: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#1B1B1B" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1B1B1B" },
  tableCell: { paddingVertical: 14, paddingHorizontal: 10, fontSize: 13, color: "#1F1F1F", borderRightWidth: 1, borderRightColor: "#1B1B1B" },
  tableCellStrong: { paddingVertical: 14, paddingHorizontal: 10, fontSize: 13, fontWeight: "700", color: "#1F1F1F", borderRightWidth: 1, borderRightColor: "#1B1B1B" },
  photoCol: { width: 130, alignItems: "center", justifyContent: "center" },
  nameCol: { width: 170 },
  applicantCol: { width: 190 },
  emailCol: { width: 250 },
  phoneCol: { width: 180 },
  licenseCol: { width: 180 },
  vehicleDetailsCol: { width: 220 },
  documentCol: { width: 180 },
  dateAppliedCol: { width: 150 },
  actionsCol: { width: 210, borderRightWidth: 0 },
  barangayCol: { flex: 1, minWidth: 260 },
  statusCol: { width: 140, borderRightWidth: 0 },
  applicationsTable: { minWidth: 1690 },
  usersTable: { minWidth: 1020 },
  tableState: { padding: 24, alignItems: "center", justifyContent: "center", gap: 8 },
  tableStateTitle: { fontSize: 16, fontWeight: "800", color: "#17382E" },
  tableStateText: { fontSize: 14, lineHeight: 20, color: "#5C7269", textAlign: "center" },
  tableMutedText: { fontSize: 12, color: "#66776F" },
  avatarImage: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EAF2EE" },
  documentImage: { width: 86, height: 58, borderRadius: 8, backgroundColor: "#EAF2EE" },
  documentButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#EAF2EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  documentButtonText: { fontSize: 12, fontWeight: "800", color: "#06774B" },
  actionsCell: { flexDirection: "row", gap: 8, alignItems: "center" },
  actionButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  approveButton: { backgroundColor: "#06774B" },
  rejectButton: { backgroundColor: "#B42318" },
  actionButtonDisabled: { backgroundColor: "#78968A" },
  actionButtonText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  cardsRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  managementCard: {
    flexGrow: 1,
    flexBasis: 290,
    maxWidth: 360,
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#08A967",
    alignItems: "center",
  },
  avatarCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 10,
    borderColor: "#000000",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  managementName: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "800",
    color: "#000000",
    fontStyle: "italic",
    textAlign: "center",
  },
  detailsCard: {
    width: "100%",
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  detailLine: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#111111",
  },
  viewButton: {
    width: "70%",
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
  },
  staffPanel: {
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E2DC",
    gap: 20,
  },
  staffIntro: { flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "center" },
  staffIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#EAF2EE",
    alignItems: "center",
    justifyContent: "center",
  },
  staffIntroCopy: { flex: 1, minWidth: 240 },
  staffTitle: { fontSize: 24, fontWeight: "900", color: "#17382E" },
  staffDescription: { marginTop: 6, fontSize: 15, lineHeight: 22, color: "#5C7269" },
  inviteForm: { flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "flex-end" },
  inviteField: { flexGrow: 1, flexBasis: 260, gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "800", color: "#335E50" },
  inviteInput: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#D3DED8",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FAFCFB",
  },
  roleOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roleOption: {
    minHeight: 54,
    flexGrow: 1,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D3DED8",
    backgroundColor: "#FAFCFB",
    alignItems: "center",
    justifyContent: "center",
  },
  roleOptionActive: { backgroundColor: "#06774B", borderColor: "#06774B" },
  roleOptionText: { fontSize: 15, fontWeight: "800", color: "#335E50" },
  roleOptionTextActive: { color: "#FFFFFF" },
  inviteButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "#06774B",
  },
  inviteButtonDisabled: { backgroundColor: "#78968A" },
  inviteButtonText: { fontSize: 15, fontWeight: "900", color: "#FFFFFF" },
  imageModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  imageModalCloseArea: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  imageModalPreview: { width: "100%", height: "84%" },
  imageModalCloseText: { marginTop: 12, fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  vehicleCard: {
    flexGrow: 1,
    flexBasis: 360,
    maxWidth: 520,
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#08A967",
    alignItems: "center",
  },
  vehicleTitle: {
    fontSize: 34,
    fontWeight: "800",
    fontStyle: "italic",
    color: "#FFFFFF",
    textAlign: "center",
  },
  vehicleImageWrap: {
    width: "100%",
    minHeight: 300,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "#BDBDBD",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleButton: {
    width: "58%",
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  vehicleButtonText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#08A967",
  },
  feedbackText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "700",
    color: "#335E50",
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "700",
    color: "#B42318",
  },
});
