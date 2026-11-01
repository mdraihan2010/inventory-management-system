import express from "express";
import { getSuppliers, createSupplier, updateSupplier } from "../controllers/supplierController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Everyone can view
router.get("/", protect, getSuppliers);

// Only Manager and Administrator can add and change suppliers
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createSupplier);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateSupplier);

export default router;
