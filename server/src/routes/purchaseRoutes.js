import express from "express";
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
} from "../controllers/purchaseController.js";
import { completePurchase, cancelPurchase } from "../controllers/purchaseStatusController.js";
import { addSupplierPayment, getPurchasePayments } from "../controllers/supplierPaymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, managersOnly, getPurchases);
router.post("/", protect, managersOnly, createPurchase);
router.get("/:id", protect, managersOnly, getPurchaseById);

// New: complete and cancel a purchase
router.post("/:id/complete", protect, managersOnly, completePurchase);
router.post("/:id/cancel", protect, managersOnly, cancelPurchase);

// Money paid to the supplier for a completed purchase
router.post("/:id/payments", protect, managersOnly, addSupplierPayment);
router.get("/:id/payments", protect, managersOnly, getPurchasePayments);

export default router;
