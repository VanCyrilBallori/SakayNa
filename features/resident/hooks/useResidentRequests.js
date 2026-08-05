import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { FIRESTORE_COLLECTIONS } from "../../../constants/app";
import { db } from "../../../firebase";
import { normalizeResidentRequest } from "../utils/requestMapper";

export default function useResidentRequests(uid) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setRequests([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");
    const requestsQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS),
      where("residentId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        setRequests(snapshot.docs.map((requestDoc) => normalizeResidentRequest(requestDoc.id, requestDoc.data())));
        setLoading(false);
      },
      () => {
        setError("Your request history could not be loaded. Check your connection and try again.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  return { requests, loading, error };
}
