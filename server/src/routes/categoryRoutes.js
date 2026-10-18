import express from "express";
import { getCategories, createCategory, updateCategory } from "../controllers/categoryController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Login করা যে কেউ দেখতে পারবে
router.get("/", protect, getCategories);

// শুধু Manager ও Administrator তৈরি ও বদলাতে পারবে
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createCategory);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateCategory);

export default router;
