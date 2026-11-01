import express from "express";
import {
  createCustomerReturn,
  getReturnableItems,
  getReturns,
} from "../controllers/returnController.js";
import {
  createSupplierReturn,
  getReturnablePurchaseItems,
} from "../controllers/supplierReturnController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Returns change products and stock, so only Manager and Administrator can do them
const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, managersOnly, getReturns);

// Customer return
router.get("/sales/:saleId/returnable", protect, managersOnly, getReturnableItems);
router.post("/customer", protect, managersOnly, createCustomerReturn);

// Supplier return
router.get("/purchases/:purchaseId/returnable", protect, managersOnly, getReturnablePurchaseItems);
router.post("/supplier", protect, managersOnly, createSupplierReturn);

export default router;
