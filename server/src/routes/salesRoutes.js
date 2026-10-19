import express from "express";
import {
  createSale,
  getSales,
  getSaleById,
  completeSale,
  cancelSale,
} from "../controllers/saleController.js";
import { addPayment, getSalePayments } from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const anyStaff = authorize("ADMINISTRATOR", "MANAGER", "STAFF");
const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, anyStaff, getSales);
router.post("/", protect, anyStaff, createSale);
router.get("/:id", protect, anyStaff, getSaleById);
router.post("/:id/complete", protect, anyStaff, completeSale);
router.post("/:id/cancel", protect, managersOnly, cancelSale);

// পরিশোধ: Staff-ও নিতে পারবে, কারণ বিক্রির সময় টাকা নেওয়া হয়
router.post("/:id/payments", protect, anyStaff, addPayment);
router.get("/:id/payments", protect, anyStaff, getSalePayments);

export default router;
