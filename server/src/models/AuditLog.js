import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 60 },
    entityType: { type: String, required: true, trim: true, maxlength: 40, index: true },
    entityId: { type: String, required: true, index: true },
    // পরিবর্তনের সারাংশ। পাসওয়ার্ড বা token এখানে কখনো থাকবে না
    summary: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
