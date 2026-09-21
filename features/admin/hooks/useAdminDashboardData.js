import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "../../../firebase";
import { getTimestampMillis } from "../../../lib/dates";

const COLLECTION_LIMIT = 200;

const sortByCreatedAtDesc = (first, second) =>
  (getTimestampMillis(second.createdAt) ?? 0) - (getTimestampMillis(first.createdAt) ?? 0);

export default function useAdminDashboardData(enabled) {
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

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribeUsers = onSnapshot(
      query(collection(db, "users"), limit(COLLECTION_LIMIT)),
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
      query(collection(db, "Driver_Applications"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        const nextApplications = snapshot.docs
          .map((applicationDoc) => ({ id: applicationDoc.id, ...applicationDoc.data() }))
          .sort(sortByCreatedAtDesc);

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
      query(collection(db, "transportRequests"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        const nextRequests = snapshot.docs
          .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }))
          .sort(sortByCreatedAtDesc);

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
      query(collection(db, "vehicles"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        const nextVehicles = snapshot.docs
          .map((vehicleDoc) => ({ id: vehicleDoc.id, ...vehicleDoc.data() }))
          .sort(sortByCreatedAtDesc);

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
      query(collection(db, "driverAssignments"), limit(COLLECTION_LIMIT)),
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
  }, [enabled]);

  return {
    users,
    driverApplications,
    transportRequests,
    vehicles,
    driverAssignments,
    isLoadingUsers,
    isLoadingApplications,
    isLoadingRequests,
    isLoadingVehicles,
    usersError,
    setUsersError,
    applicationsError,
    requestsError,
    vehiclesError,
    setVehiclesError,
  };
}
