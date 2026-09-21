import { collection, getCountFromServer, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "../../../firebase";
import { getTimestampMillis } from "../../../lib/dates";

const COLLECTION_LIMIT = 200;
// Quiet period before re-counting, so bursts of listener fires (e.g. the driver
// presence heartbeat writing to user documents) collapse into a single re-count.
const COUNT_DEBOUNCE_MS = 2000;

const sortByCreatedAtDesc = (first, second) =>
  (getTimestampMillis(second.createdAt) ?? 0) - (getTimestampMillis(first.createdAt) ?? 0);

// null means "server count not loaded yet"; callers fall back to the client-side tally.
const EMPTY_COUNTS = {
  emergencyRequests: null,
  communityRequests: null,
  activeRequests: null,
  completedRequests: null,
  cancelledRequests: null,
  registeredDrivers: null,
  availableDrivers: null,
  registeredVehicles: null,
};

const readCount = async (builtQuery) => (await getCountFromServer(builtQuery)).data().count;

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

  // Bumped by each listener so the matching server-side counts re-run on live changes.
  const [usersRevision, setUsersRevision] = useState(0);
  const [requestsRevision, setRequestsRevision] = useState(0);
  const [vehiclesRevision, setVehiclesRevision] = useState(0);

  const [counts, setCounts] = useState(EMPTY_COUNTS);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribeUsers = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        setUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
        setUsersError("");
        setIsLoadingUsers(false);
        setUsersRevision((value) => value + 1);
      },
      (error) => {
        console.log("Users listener warning:", error);
        setUsersError("Users could not be loaded. Please check Firestore permissions.");
        setIsLoadingUsers(false);
      }
    );

    const unsubscribeApplications = onSnapshot(
      query(collection(db, "Driver_Applications"), orderBy("createdAt", "desc"), limit(COLLECTION_LIMIT)),
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
      query(collection(db, "transportRequests"), orderBy("createdAt", "desc"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        const nextRequests = snapshot.docs
          .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }))
          .sort(sortByCreatedAtDesc);

        setTransportRequests(nextRequests);
        setRequestsError("");
        setIsLoadingRequests(false);
        setRequestsRevision((value) => value + 1);
      },
      (error) => {
        console.log("Transport requests listener warning:", error);
        setRequestsError("Transport requests could not be loaded. Please check Firestore permissions.");
        setIsLoadingRequests(false);
      }
    );

    const unsubscribeVehicles = onSnapshot(
      query(collection(db, "vehicles"), orderBy("createdAt", "desc"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        const nextVehicles = snapshot.docs
          .map((vehicleDoc) => ({ id: vehicleDoc.id, ...vehicleDoc.data() }))
          .sort(sortByCreatedAtDesc);

        setVehicles(nextVehicles);
        setVehiclesError("");
        setIsLoadingVehicles(false);
        setVehiclesRevision((value) => value + 1);
      },
      (error) => {
        console.log("Vehicles listener warning:", error);
        setVehiclesError("Vehicles could not be loaded. Please check Firestore permissions.");
        setIsLoadingVehicles(false);
      }
    );

    const unsubscribeAssignments = onSnapshot(
      query(collection(db, "driverAssignments"), orderBy("createdAt", "desc"), limit(COLLECTION_LIMIT)),
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

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    const requestsRef = collection(db, "transportRequests");

    const timeoutId = setTimeout(() => {
      Promise.all([
        readCount(query(requestsRef, where("requestType", "==", "Emergency Request"))),
        readCount(query(requestsRef, where("requestType", "==", "Community Transport Request"))),
        readCount(query(requestsRef, where("status", "not-in", ["Completed", "Cancelled"]))),
        readCount(query(requestsRef, where("status", "==", "Completed"))),
        readCount(query(requestsRef, where("status", "==", "Cancelled"))),
      ])
        .then(([emergencyRequests, communityRequests, activeRequests, completedRequests, cancelledRequests]) => {
          if (!cancelled) {
            setCounts((current) => ({
              ...current,
              emergencyRequests,
              communityRequests,
              activeRequests,
              completedRequests,
              cancelledRequests,
            }));
          }
        })
        .catch((error) => console.log("Request counts warning:", error));
    }, COUNT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, requestsRevision]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    const usersRef = collection(db, "users");

    const timeoutId = setTimeout(() => {
      Promise.all([
        readCount(query(usersRef, where("role", "==", "Driver"))),
        readCount(
          query(
            usersRef,
            where("role", "==", "Driver"),
            where("accountStatus", "==", "Approved"),
            where("availability", "==", "Available")
          )
        ),
      ])
        .then(([registeredDrivers, availableDrivers]) => {
          if (!cancelled) {
            setCounts((current) => ({ ...current, registeredDrivers, availableDrivers }));
          }
        })
        .catch((error) => console.log("User counts warning:", error));
    }, COUNT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, usersRevision]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      readCount(collection(db, "vehicles"))
        .then((registeredVehicles) => {
          if (!cancelled) {
            setCounts((current) => ({ ...current, registeredVehicles }));
          }
        })
        .catch((error) => console.log("Vehicle count warning:", error));
    }, COUNT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, vehiclesRevision]);

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
    usersAtLimit: users.length === COLLECTION_LIMIT,
    requestsAtLimit: transportRequests.length === COLLECTION_LIMIT,
    vehiclesAtLimit: vehicles.length === COLLECTION_LIMIT,
    collectionLimit: COLLECTION_LIMIT,
    counts,
  };
}
