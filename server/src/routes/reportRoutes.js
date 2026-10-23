import express from "express";
import {
  salesReport,
  purchasesReport,
  stockValueReport,
  profitReport,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Reports শুধু Manager ও Administrator দেখবে
const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/sales", protect, managersOnly, salesReport);
router.get("/purchases", protect, managersOnly, purchasesReport);
router.get("/stock-value", protect, managersOnly, stockValueReport);
router.get("/profit", protect, managersOnly, profitReport);

export default router;
