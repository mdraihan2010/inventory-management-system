import express from "express";
import { getSuppliers, createSupplier, updateSupplier } from "../controllers/supplierController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// সবাই দেখতে পারবে
router.get("/", protect, getSuppliers);

// Supplier যোগ ও বদলানো Manager ও Administrator-এর কাজ
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createSupplier);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateSupplier);

export default router;
