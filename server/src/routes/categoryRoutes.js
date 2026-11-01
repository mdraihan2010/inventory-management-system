import express from "express";
import { getCategories, createCategory, updateCategory } from "../controllers/categoryController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Any logged-in user can view
router.get("/", protect, getCategories);

// Only Manager and Administrator can create and change
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createCategory);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateCategory);

export default router;
