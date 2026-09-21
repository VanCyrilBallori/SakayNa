import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { FIRESTORE_COLLECTIONS } from "../../../constants/app";
import { db } from "../../../firebase";
import { normalizeResidentRequest } from "../utils/requestMapper";

const toMillis = (value) => value?.toMillis?.() ?? (value ? new Date(value).getTime() || 0 : 0);

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
    // Single-field filter only (no orderBy) so no composite index is needed. Sorted below.
    const requestsQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS),
      where("residentId", "==", uid)
    );
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((requestDoc) => normalizeResidentRequest(requestDoc.id, requestDoc.data()))
          .sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt))
          .slice(0, 50);
        setRequests(rows);
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
