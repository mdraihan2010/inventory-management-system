import AuditLog from "../models/AuditLog.js";

// Records one change. If the record cannot be saved, it only logs a warning and does not stop the main action
export async function logAudit({ userId, action, entityType, entityId, summary = "" }) {
  try {
    await AuditLog.create({
      user: userId,
      action,
      entityType,
      entityId: String(entityId),
      summary,
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
}
