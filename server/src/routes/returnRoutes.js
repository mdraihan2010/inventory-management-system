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

// ফেরতে পণ্য ও স্টক বদলায়, তাই শুধু Manager ও Administrator
const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, managersOnly, getReturns);

// গ্রাহকের ফেরত
router.get("/sales/:saleId/returnable", protect, managersOnly, getReturnableItems);
router.post("/customer", protect, managersOnly, createCustomerReturn);

// সরবরাহকারীকে ফেরত
router.get("/purchases/:purchaseId/returnable", protect, managersOnly, getReturnablePurchaseItems);
router.post("/supplier", protect, managersOnly, createSupplierReturn);

export default router;
