import express from "express";
import { getCustomers, createCustomer, updateCustomer } from "../controllers/customerController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Everyone can view
router.get("/", protect, getCustomers);

// Staff can add a new customer, because it is needed during a sale
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER", "STAFF"), createCustomer);

// Only Manager and Administrator can change customer details
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateCustomer);

export default router;
