import express from "express";
import {
  getUsers,
  createUser,
  updateUser,
  changePassword,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const adminOnly = authorize("ADMINISTRATOR");

// Any logged-in user can change their own password
router.post("/change-password", protect, changePassword);

// User management is only for Administrator
router.get("/", protect, adminOnly, getUsers);
router.post("/", protect, adminOnly, createUser);
router.patch("/:id", protect, adminOnly, updateUser);

export default router;
