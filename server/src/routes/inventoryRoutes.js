import express from "express";
import {
  adjustStock,
  getStockMovements,
  getStockAlerts,
} from "../controllers/inventoryController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// স্টক বদলানো শুধু Manager ও Administrator-এর কাজ
router.post("/adjustments", protect, authorize("ADMINISTRATOR", "MANAGER"), adjustStock);

// ইতিহাস ও সতর্কতা সবাই দেখতে পারবে
router.get("/movements", protect, getStockMovements);
router.get("/alerts", protect, getStockAlerts);

export default router;
