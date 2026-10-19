import express from "express";
import {
  createSale,
  getSales,
  getSaleById,
  completeSale,
  cancelSale,
} from "../controllers/saleController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Staff বিক্রি তৈরি ও সম্পন্ন করতে পারবে
const anyStaff = authorize("ADMINISTRATOR", "MANAGER", "STAFF");
// বাতিল করা শুধু Manager ও Administrator-এর কাজ
const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, anyStaff, getSales);
router.post("/", protect, anyStaff, createSale);
router.get("/:id", protect, anyStaff, getSaleById);
router.post("/:id/complete", protect, anyStaff, completeSale);
router.post("/:id/cancel", protect, managersOnly, cancelSale);

export default router;
