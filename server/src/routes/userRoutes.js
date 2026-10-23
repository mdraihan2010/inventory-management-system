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

// যে কোনো login করা user নিজের password বদলাতে পারবে
router.post("/change-password", protect, changePassword);

// User ব্যবস্থাপনা শুধু Administrator-এর কাজ
router.get("/", protect, adminOnly, getUsers);
router.post("/", protect, adminOnly, createUser);
router.patch("/:id", protect, adminOnly, updateUser);

export default router;
