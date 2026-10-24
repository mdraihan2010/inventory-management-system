import express from "express";
import {
  changeOwnEmail,
  resetUserPassword,
  updateUserProfile,
} from "../controllers/accountController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const adminOnly = authorize("ADMINISTRATOR");

// যে কেউ নিজের email বদলাতে পারবে
router.post("/change-email", protect, changeOwnEmail);

// শুধু Administrator অন্যদের নাম, email বা অস্থায়ী password বদলাবে
router.patch("/:id/profile", protect, adminOnly, updateUserProfile);
router.post("/:id/reset-password", protect, adminOnly, resetUserPassword);

export default router;
