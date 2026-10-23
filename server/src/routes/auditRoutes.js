import express from "express";
import AuditLog from "../models/AuditLog.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// শুধু Administrator দেখতে পারবে
router.get("/", protect, authorize("ADMINISTRATOR"), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {};
    if (typeof req.query.entityType === "string" && req.query.entityType) {
      filter.entityType = req.query.entityType;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: logs,
    });
  } catch (error) {
    console.error("Get audit logs error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching audit logs" });
  }
});

export default router;
