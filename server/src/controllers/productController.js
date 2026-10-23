import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import { logAudit } from "../utils/auditLogger.js";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function checkReference(Model, id, label) {
  if (!id) {
    return `${label} is required`;
  }
  if (!mongoose.isValidObjectId(id)) {
    return `Invalid ${label.toLowerCase()} id`;
  }
  const item = await Model.findById(id);
  if (!item) {
    return `${label} not found`;
  }
  if (!item.isActive) {
    return `${label} is inactive`;
  }
  return null;
}

function duplicateMessage(error) {
  const field = Object.keys(error.keyPattern || {})[0];
  return field === "barcode" ? "Barcode already exists" : "SKU already exists";
}

export async function getProducts(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = {};

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ name: pattern }, { sku: pattern }, { barcode: pattern }];
    }

    if (typeof req.query.category === "string" && mongoose.isValidObjectId(req.query.category)) {
      filter.category = req.query.category;
    }

    if (typeof req.query.brand === "string" && mongoose.isValidObjectId(req.query.brand)) {
      filter.brand = req.query.brand;
    }

    if (req.query.isActive === "true" || req.query.isActive === "false") {
      filter.isActive = req.query.isActive === "true";
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name")
        .populate("brand", "name")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching products" });
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("brand", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error("Get product error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching product" });
  }
}

export async function createProduct(req, res) {
  try {
    const body = req.body || {};

    if (typeof body.name !== "string" || !body.name.trim()) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (typeof body.sku !== "string" || !body.sku.trim()) {
      return res.status(400).json({ success: false, message: "SKU is required" });
    }

    const categoryError = await checkReference(Category, body.category, "Category");
    if (categoryError) {
      return res.status(400).json({ success: false, message: categoryError });
    }

    const brandError = await checkReference(Brand, body.brand, "Brand");
    if (brandError) {
      return res.status(400).json({ success: false, message: brandError });
    }

    const product = await Product.create({
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      description: body.description,
      category: body.category,
      brand: body.brand,
      purchasePrice: body.purchasePrice,
      sellingPrice: body.sellingPrice,
      minStockLevel: body.minStockLevel,
      unit: body.unit,
    });

    await logAudit({
      userId: req.user._id,
      action: "CREATE",
      entityType: "Product",
      entityId: product._id,
      summary: `Created product ${product.name} (SKU ${product.sku})`,
    });

    res.status(201).json({ success: true, message: "Product created", data: product });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: duplicateMessage(error) });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create product error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating product" });
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const body = req.body || {};

    const allowedFields = [
      "name",
      "sku",
      "barcode",
      "description",
      "category",
      "brand",
      "purchasePrice",
      "sellingPrice",
      "minStockLevel",
      "unit",
      "isActive",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    if (updates.category !== undefined) {
      const categoryError = await checkReference(Category, updates.category, "Category");
      if (categoryError) {
        return res.status(400).json({ success: false, message: categoryError });
      }
    }

    if (updates.brand !== undefined) {
      const brandError = await checkReference(Brand, updates.brand, "Brand");
      if (brandError) {
        return res.status(400).json({ success: false, message: brandError });
      }
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      returnDocument: "after",
      runValidators: true,
    })
      .populate("category", "name")
      .populate("brand", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await logAudit({
      userId: req.user._id,
      action: "UPDATE",
      entityType: "Product",
      entityId: product._id,
      summary: `Updated fields: ${Object.keys(updates).join(", ")}`,
    });

    res.status(200).json({ success: true, message: "Product updated", data: product });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: duplicateMessage(error) });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Update product error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating product" });
  }
}
