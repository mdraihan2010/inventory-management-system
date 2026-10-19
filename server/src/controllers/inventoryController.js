import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement, { MOVEMENT_TYPES } from "../models/StockMovement.js";

// কোন ধরনের movement হলে স্টক বাড়ে, কোনটায় কমে
const INCREASING_TYPES = ["OPENING_STOCK", "PURCHASE", "CUSTOMER_RETURN"];
const DECREASING_TYPES = ["SALE", "SUPPLIER_RETURN", "DAMAGED"];

// একটা নির্দিষ্ট পরিমাণ স্টক পরিবর্তন করে, এবং রেকর্ড রাখে
export async function adjustStock(req, res) {
  try {
    const body = req.body || {};
    const { productId, type, quantity, reason } = body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    if (!MOVEMENT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid movement type" });
    }

    // পরিমাণ অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে। চিহ্ন type ঠিক করে, ব্যবহারকারী নয়
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive whole number" });
    }

    // ADJUSTMENT সবসময় কারণসহ হতে হবে
    if (type === "ADJUSTMENT" && (typeof reason !== "string" || !reason.trim())) {
      return res.status(400).json({ success: false, message: "A reason is required for stock adjustment" });
    }

    let change;
    if (INCREASING_TYPES.includes(type)) {
      change = quantity;
    } else if (DECREASING_TYPES.includes(type)) {
      change = -quantity;
    } else {
      // ADJUSTMENT-এ quantity নিজে চিহ্নসহ নেওয়ার জন্য আলাদা নিয়ম দরকার, তাই এখন বাদ
      return res.status(400).json({
        success: false,
        message: "Use a supported movement type: OPENING_STOCK, PURCHASE, CUSTOMER_RETURN, SALE, SUPPLIER_RETURN or DAMAGED",
      });
    }

    // শর্তসহ আপডেট: স্টক যথেষ্ট না থাকলে কিছুই বদলাবে না
    const filter = { _id: productId };
    if (change < 0) {
      filter.currentStock = { $gte: quantity };
    }

    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { currentStock: change } },
      { new: true }
    );

    if (!product) {
      // পণ্যটি আছে কিনা না থাকলে কারণ আলাদা করে জানাই
      const exists = await Product.exists({ _id: productId });
      if (!exists) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      return res.status(409).json({ success: false, message: "Not enough stock available" });
    }

    const resultingStock = product.currentStock;
    const previousStock = resultingStock - change;

    const movement = await StockMovement.create({
      product: productId,
      type,
      change,
      previousStock,
      resultingStock,
      reason: reason || "",
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Stock updated",
      data: {
        product: { _id: product._id, name: product.name, currentStock: product.currentStock },
        movement,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Adjust stock error:", error.message);
    res.status(500).json({ success: false, message: "Server error while adjusting stock" });
  }
}

// একটা পণ্যের স্টক পরিবর্তনের ইতিহাস, সবচেয়ে নতুনটা আগে
export async function getStockMovements(req, res) {
  try {
    const { productId } = req.query;
    const filter = {};

    if (productId) {
      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product id" });
      }
      filter.product = productId;
    }

    const movements = await StockMovement.find(filter)
      .populate("product", "name sku")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, count: movements.length, data: movements });
  } catch (error) {
    console.error("Get movements error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching movements" });
  }
}

// স্টক শেষ হয়ে গেছে এমন পণ্য, এবং স্টক কম এমন পণ্য
export async function getStockAlerts(req, res) {
  try {
    const outOfStock = await Product.find({ isActive: true, currentStock: 0 })
      .select("name sku currentStock minStockLevel")
      .sort({ name: 1 });

    const lowStock = await Product.find({
      isActive: true,
      currentStock: { $gt: 0 },
      $expr: { $lte: ["$currentStock", "$minStockLevel"] },
    })
      .select("name sku currentStock minStockLevel")
      .sort({ currentStock: 1 });

    res.status(200).json({
      success: true,
      outOfStock: { count: outOfStock.length, data: outOfStock },
      lowStock: { count: lowStock.length, data: lowStock },
    });
  } catch (error) {
    console.error("Stock alerts error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching alerts" });
  }
}
