import express from "express";
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
} from "../controllers/purchaseController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Purchase শুধু Manager ও Administrator দেখবে ও তৈরি করবে
router.get("/", protect, authorize("ADMINISTRATOR", "MANAGER"), getPurchases);
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createPurchase);
router.get("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), getPurchaseById);

export default router;
