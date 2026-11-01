import express from "express";
import { login, getMe } from "../controllers/authController.js";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";

// Login limit: at most 10 attempts per IP in 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again after 15 minutes." },
});

const router = express.Router();

router.post("/login", loginLimiter, login);
router.get("/me", protect, getMe);

export default router;
