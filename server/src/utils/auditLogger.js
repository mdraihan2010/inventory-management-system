import AuditLog from "../models/AuditLog.js";

// একটা পরিবর্তনের রেকর্ড রাখে। রেকর্ড রাখতে না পারলে শুধু সতর্কবার্তা দেয়, মূল কাজ থামায় না
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
