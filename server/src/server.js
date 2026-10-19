import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
  })
);
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Inventory Management System API is running!",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/brands", brandRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/suppliers", supplierRoutes);

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
