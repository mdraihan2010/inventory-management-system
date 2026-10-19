import express from "express";
import { getBrands, createBrand, updateBrand } from "../controllers/brandController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getBrands);
router.post("/", protect, authorize("ADMINISTRATOR", "MANAGER"), createBrand);
router.patch("/:id", protect, authorize("ADMINISTRATOR", "MANAGER"), updateBrand);

export default router;
