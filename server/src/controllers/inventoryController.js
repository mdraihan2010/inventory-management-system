import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement, { MOVEMENT_TYPES } from "../models/StockMovement.js";

// Which movement types increase stock and which decrease it
const INCREASING_TYPES = ["OPENING_STOCK", "PURCHASE", "CUSTOMER_RETURN"];
const DECREASING_TYPES = ["SALE", "SUPPLIER_RETURN", "DAMAGED"];

// Changes stock by a set quantity and keeps a record
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

    // The quantity must be a positive whole number. The type sets the sign, not the user
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive whole number" });
    }

    // An ADJUSTMENT must always have a reason
    if (type === "ADJUSTMENT" && (typeof reason !== "string" || !reason.trim())) {
      return res.status(400).json({ success: false, message: "A reason is required for stock adjustment" });
    }

    let change;
    if (INCREASING_TYPES.includes(type)) {
      change = quantity;
    } else if (DECREASING_TYPES.includes(type)) {
      change = -quantity;
    } else {
      // ADJUSTMENT with a signed quantity needs its own rules, so it is not supported yet
      return res.status(400).json({
        success: false,
        message: "Use a supported movement type: OPENING_STOCK, PURCHASE, CUSTOMER_RETURN, SALE, SUPPLIER_RETURN or DAMAGED",
      });
    }

    // Conditional update: if there is not enough stock, nothing changes
    const filter = { _id: productId };
    if (change < 0) {
      filter.currentStock = { $gte: quantity };
    }

    const session = await mongoose.startSession();
    let product;
    let movement;

    try {
      await session.withTransaction(async () => {
        product = await Product.findOneAndUpdate(
          filter,
          { $inc: { currentStock: change } },
          { new: true, session }
        );

        if (!product) {
          // If the product is missing, report that separately as the reason
          const exists = await Product.exists({ _id: productId }).session(session);
          if (!exists) {
            throw Object.assign(new Error("Product not found"), { status: 404 });
          }
          throw Object.assign(new Error("Not enough stock available"), { status: 409 });
        }

        const resultingStock = product.currentStock;
        const previousStock = resultingStock - change;

        // The stock change and its history record are saved together, or not at all
        [movement] = await StockMovement.create(
          [{
            product: productId,
            type,
            change,
            previousStock,
            resultingStock,
            reason: reason || "",
            createdBy: req.user._id,
          }],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      message: "Stock updated",
      data: {
        product: { _id: product._id, name: product.name, currentStock: product.currentStock },
        movement,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Adjust stock error:", error.message);
    res.status(500).json({ success: false, message: "Server error while adjusting stock" });
  }
}

// Stock change history for one product, newest first
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

// Products that are out of stock, and products with low stock
export async function getStockAlerts(req, res) {
  try {
    // The counts cover every product. The lists only hold the first products, so the answer stays small
    const ALERT_LIST_LIMIT = 50;
    const outFilter = { isActive: true, currentStock: { $lte: 0 } };
    const lowFilter = {
      isActive: true,
      currentStock: { $gt: 0 },
      $expr: { $lte: ["$currentStock", "$minStockLevel"] },
    };

    const [outOfStock, outCount, lowStock, lowCount] = await Promise.all([
      Product.find(outFilter).select("name sku currentStock minStockLevel").sort({ name: 1 }).limit(ALERT_LIST_LIMIT),
      Product.countDocuments(outFilter),
      Product.find(lowFilter).select("name sku currentStock minStockLevel").sort({ currentStock: 1 }).limit(ALERT_LIST_LIMIT),
      Product.countDocuments(lowFilter),
    ]);

    res.status(200).json({
      success: true,
      outOfStock: { count: outCount, data: outOfStock },
      lowStock: { count: lowCount, data: lowStock },
    });
  } catch (error) {
    console.error("Stock alerts error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching alerts" });
  }
}
