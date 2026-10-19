import express from "express";
import { getAllPayments } from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, authorize("ADMINISTRATOR", "MANAGER"), getAllPayments);

export default router;
