import crypto from "crypto";
import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Supplier from "../models/Supplier.js";
import Product from "../models/Product.js";

const STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"];

// Money amounts are kept to two decimal places
function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// For example PUR-20261019-A1B2C3
function makePurchaseNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PUR-${date}-${random}`;
}

export async function createPurchase(req, res) {
  try {
    const body = req.body || {};

    if (!mongoose.isValidObjectId(body.supplier)) {
      return res.status(400).json({ success: false, message: "Valid supplier id is required" });
    }

    const supplier = await Supplier.findById(body.supplier);
    if (!supplier) {
      return res.status(400).json({ success: false, message: "Supplier not found" });
    }
    if (!supplier.isActive) {
      return res.status(400).json({ success: false, message: "Supplier is inactive" });
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one item is required" });
    }

    for (const item of body.items) {
      if (typeof item !== "object" || item === null) {
        return res.status(400).json({ success: false, message: "Each item must be an object" });
      }
      if (!mongoose.isValidObjectId(item.productId)) {
        return res.status(400).json({ success: false, message: "Invalid product id in items" });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: "Quantity must be a positive whole number" });
      }
      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
        return res.status(400).json({ success: false, message: "Unit price must be zero or more" });
      }
    }

    const productIds = body.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ success: false, message: "The same product cannot appear twice" });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    const productById = new Map(products.map((p) => [p._id.toString(), p]));

    const items = [];
    for (const item of body.items) {
      const product = productById.get(item.productId);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
      }
      if (!product.isActive) {
        return res.status(400).json({ success: false, message: `Product is inactive: ${product.name}` });
      }
      items.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: roundMoney(item.quantity * item.unitPrice),
      });
    }

    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));

    const discount = body.discount === undefined ? 0 : body.discount;
    if (typeof discount !== "number" || discount < 0 || discount > subtotal) {
      return res.status(400).json({ success: false, message: "Discount must be between 0 and the subtotal" });
    }

    const purchase = await Purchase.create({
      purchaseNumber: makePurchaseNumber(),
      supplier: supplier._id,
      items,
      subtotal,
      discount,
      grandTotal: roundMoney(subtotal - discount),
      notes: body.notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: "Purchase draft created", data: purchase });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create purchase error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating purchase" });
  }
}

// All purchases, newest first. Can be filtered by status or supplier
export async function getPurchases(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = {};
    if (STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (typeof req.query.supplier === "string" && mongoose.isValidObjectId(req.query.supplier)) {
      filter.supplier = req.query.supplier;
    }

    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate("supplier", "name companyName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Purchase.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: purchases,
    });
  } catch (error) {
    console.error("Get purchases error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching purchases" });
  }
}

// Details of one purchase
export async function getPurchaseById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase id" });
    }

    const purchase = await Purchase.findById(id)
      .populate("supplier", "name companyName phone")
      .populate("createdBy", "name email");

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    console.error("Get purchase error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching purchase" });
  }
}
