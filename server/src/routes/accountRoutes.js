import express from "express";
import {
  changeOwnEmail,
  resetUserPassword,
  updateUserProfile,
} from "../controllers/accountController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const adminOnly = authorize("ADMINISTRATOR");

// Any logged-in user can change their own email
router.post("/change-email", protect, changeOwnEmail);

// Only Administrator can change others' name, email or temporary password
router.patch("/:id/profile", protect, adminOnly, updateUserProfile);
router.post("/:id/reset-password", protect, adminOnly, resetUserPassword);

export default router;
