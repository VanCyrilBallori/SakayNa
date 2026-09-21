import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "../../../firebase";
import { getTimestampMillis } from "../../../lib/dates";

const COLLECTION_LIMIT = 100;
const STALE_RINGING_THRESHOLD_MS = 30_000;
const TICK_INTERVAL_MS = 5_000;

export default function useAdminCallSessions(enabled) {
  const [rawCallSessions, setRawCallSessions] = useState([]);
  const [isLoadingCallSessions, setIsLoadingCallSessions] = useState(true);
  const [callSessionsError, setCallSessionsError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, "callSessions"), limit(COLLECTION_LIMIT)),
      (snapshot) => {
        setRawCallSessions(snapshot.docs.map((callDoc) => ({ id: callDoc.id, ...callDoc.data() })));
        setCallSessionsError("");
        setIsLoadingCallSessions(false);
      },
      (error) => {
        console.log("Call sessions listener warning:", error);
        setCallSessionsError("Emergency call history could not be loaded. Please check Firestore permissions.");
        setIsLoadingCallSessions(false);
      }
    );

    return unsubscribe;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const intervalId = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled]);

  const callSessions = rawCallSessions
    .map((call) => {
      const createdAtMillis = getTimestampMillis(call.createdAt);
      const waitingMs = createdAtMillis ? now - createdAtMillis : null;
      const isStaleRinging = call.status === "ringing" && typeof waitingMs === "number" && waitingMs > STALE_RINGING_THRESHOLD_MS;

      return { ...call, createdAtMillis, waitingMs, isStaleRinging };
    })
    .sort((first, second) => {
      if (first.isStaleRinging !== second.isStaleRinging) {
        return first.isStaleRinging ? -1 : 1;
      }

      if (first.isStaleRinging) {
        return (first.createdAtMillis ?? 0) - (second.createdAtMillis ?? 0);
      }

      return (second.createdAtMillis ?? 0) - (first.createdAtMillis ?? 0);
    });

  const staleRingingCount = callSessions.filter((call) => call.isStaleRinging).length;

  return { callSessions, staleRingingCount, isLoadingCallSessions, callSessionsError };
}
