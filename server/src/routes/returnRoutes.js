import express from "express";
import {
  createCustomerReturn,
  getReturnableItems,
  getReturns,
} from "../controllers/returnController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ফেরতে টাকা ফেরত যায়, তাই শুধু Manager ও Administrator
const managersOnly = authorize("ADMINISTRATOR", "MANAGER");

router.get("/", protect, managersOnly, getReturns);
router.get("/sales/:saleId/returnable", protect, managersOnly, getReturnableItems);
router.post("/customer", protect, managersOnly, createCustomerReturn);

export default router;
