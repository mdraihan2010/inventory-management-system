import express from "express";
import {
  adjustStock,
  getStockMovements,
  getStockAlerts,
} from "../controllers/inventoryController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only Manager and Administrator can change stock
router.post("/adjustments", protect, authorize("ADMINISTRATOR", "MANAGER"), adjustStock);

// Everyone can view history and alerts
router.get("/movements", protect, getStockMovements);
router.get("/alerts", protect, getStockAlerts);

export default router;
