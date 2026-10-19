import express from "express";
import { getCustomers, createCustomer, updateCustomer } from "../controllers/customerController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// সবাই দেখতে পারবে
router.get("/", protect, getCustomers);

// Staff নতুন customer যোগ করতে পারবে, কারণ বিক্রির সময় এটা দরকার
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER", "STAFF"), createCustomer);

// তথ্য বদলানো শুধু Manager ও Administrator-এর কাজ
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateCustomer);

export default router;
