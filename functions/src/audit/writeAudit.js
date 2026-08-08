const { COLLECTIONS } = require("../config/constants");
const { db, FieldValue } = require("../config/firebase");

const auditRef = () => db.collection(COLLECTIONS.AUDIT_LOGS).doc();
const redact = (value) => {
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  ["password", "token", "resetLink", "uploaded_document", "documents", "address", "email"].forEach((key) => delete copy[key]);
  return copy;
};
const writeAudit = (transaction, { action, actor, targetType, targetId, summary, before, after, metadata = {}, requestId, assignmentId }) => {
  transaction.set(auditRef(), { action, actorId: actor.id, actorRole: actor.role, actorClaims: { role: actor.role, permissions: actor.permissions || [] }, targetType, targetId, summary, before: redact(before), after: redact(after), metadata: redact(metadata), requestId: requestId || null, assignmentId: assignmentId || null, authoritative: true, createdAt: FieldValue.serverTimestamp() });
};
module.exports = { writeAudit };