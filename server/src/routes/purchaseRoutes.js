import express from "express";
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
} from "../controllers/purchaseController.js";
import { completePurchase, cancelPurchase } from "../controllers/purchaseStatusController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, managersOnly, getPurchases);
router.post("/", protect, managersOnly, createPurchase);
router.get("/:id", protect, managersOnly, getPurchaseById);

// নতুন: চালান সম্পন্ন ও বাতিল
router.post("/:id/complete", protect, managersOnly, completePurchase);
router.post("/:id/cancel", protect, managersOnly, cancelPurchase);

export default router;
