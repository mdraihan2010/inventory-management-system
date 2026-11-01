import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
} from "../controllers/productController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Everyone logged in, including Staff, can view
router.get("/", protect, getProducts);
router.get("/:id", protect, getProductById);

// Only Manager and Administrator can create and change
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createProduct);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateProduct);

export default router;
