import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
} from "../controllers/productController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Login করা সবাই দেখতে পারবে, Staff সহ
router.get("/", protect, getProducts);
router.get("/:id", protect, getProductById);

// শুধু Manager ও Administrator তৈরি ও বদলাতে পারবে
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createProduct);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateProduct);

export default router;
