import crypto from "crypto";
import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { logAudit } from "../utils/auditLogger.js";

const STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"];

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function makeSaleNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SAL-${date}-${random}`;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function paymentStatusFor(grandTotal, paidAmount) {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= grandTotal) return "PAID";
  return "PARTIALLY_PAID";
}

// POST /api/v1/sales: খসড়া বিক্রি তৈরি, স্টক এখনো কমে না
export async function createSale(req, res) {
  try {
    const body = req.body || {};

    let customerId = null;
    if (body.customer !== undefined && body.customer !== null && body.customer !== "") {
      if (!mongoose.isValidObjectId(body.customer)) {
        return res.status(400).json({ success: false, message: "Invalid customer id" });
      }
      const customer = await Customer.findById(body.customer);
      if (!customer) {
        return res.status(400).json({ success: false, message: "Customer not found" });
      }
      if (!customer.isActive) {
        return res.status(400).json({ success: false, message: "Customer is inactive" });
      }
      customerId = customer._id;
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
        unitPrice: product.sellingPrice,
        lineTotal: roundMoney(item.quantity * product.sellingPrice),
      });
    }

    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));

    const discount = body.discount === undefined ? 0 : body.discount;
    if (typeof discount !== "number" || discount < 0 || discount > subtotal) {
      return res.status(400).json({ success: false, message: "Discount must be between 0 and the subtotal" });
    }

    const grandTotal = roundMoney(subtotal - discount);

    // পরিশোধ শুধু সম্পন্ন বিক্রির পরে, Payment API দিয়ে
    const paidAmount = 0;

    const sale = await Sale.create({
      saleNumber: makeSaleNumber(),
      customer: customerId,
      items,
      subtotal,
      discount,
      grandTotal,
      paidAmount,
      outstandingAmount: grandTotal,
      paymentStatus: paymentStatusFor(grandTotal, paidAmount),
      notes: body.notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: "Sale draft created", data: sale });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create sale error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating sale" });
  }
}

// GET /api/v1/sales: সব বিক্রি, নতুনটা আগে
export async function getSales(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = {};
    if (STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.customer === "walkin") {
      filter.customer = null;
    } else if (typeof req.query.customer === "string" && mongoose.isValidObjectId(req.query.customer)) {
      filter.customer = req.query.customer;
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate("customer", "name phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Sale.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: sales,
    });
  } catch (error) {
    console.error("Get sales error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching sales" });
  }
}

// GET /api/v1/sales/:id
export async function getSaleById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const sale = await Sale.findById(id)
      .populate("customer", "name phone")
      .populate("createdBy", "name email");

    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    console.error("Get sale error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching sale" });
  }
}

// একটা transaction-এর ভিতরে সব কাজ: status, স্টক, রেকর্ড, এবং ক্রয়মূল্য
async function completeInsideTransaction(saleId, userId, session) {
  const sale = await Sale.findOneAndUpdate(
    { _id: saleId, status: "DRAFT" },
    { status: "COMPLETED" },
    { returnDocument: "after", session }
  );

  if (!sale) {
    const exists = await Sale.exists({ _id: saleId }).session(session);
    if (!exists) {
      throw httpError(404, "Sale not found");
    }
    throw httpError(409, "Only draft sales can be completed");
  }

  const updatedItems = [];

  for (const item of sale.items) {
    const product = await Product.findOneAndUpdate(
      { _id: item.product, currentStock: { $gte: item.quantity } },
      { $inc: { currentStock: -item.quantity } },
      { returnDocument: "after", session }
    );

    if (!product) {
      const exists = await Product.exists({ _id: item.product }).session(session);
      if (!exists) {
        throw httpError(400, `Product not found: ${item.productName}`);
      }
      throw httpError(409, `Not enough stock for ${item.productName}`);
    }

    const resultingStock = product.currentStock;
    const previousStock = resultingStock + item.quantity;

    await StockMovement.create(
      [
        {
          product: product._id,
          type: "SALE",
          change: -item.quantity,
          previousStock,
          resultingStock,
          reason: `Sale ${sale.saleNumber}`,
          createdBy: userId,
        },
      ],
      { session }
    );

    updatedItems.push({
      product: item.product,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      costPrice: product.purchasePrice,
    });
  }

  const saved = await Sale.findOneAndUpdate(
    { _id: saleId },
    { $set: { items: updatedItems } },
    { returnDocument: "after", session }
  );

  return saved;
}

// POST /api/v1/sales/:id/complete
export async function completeSale(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid sale id" });
  }

  const session = await mongoose.startSession();

  try {
    let completed;

    await session.withTransaction(async () => {
      completed = await completeInsideTransaction(id, req.user._id, session);
    });

    // আর্থিক সিদ্ধান্ত: transaction সফল হওয়ার পরে রেকর্ড
    await logAudit({
      userId: req.user._id,
      action: "COMPLETE",
      entityType: "Sale",
      entityId: completed._id,
      summary: `Completed sale ${completed.saleNumber} for ${completed.grandTotal}`,
    });

    res.status(200).json({
      success: true,
      message: "Sale completed and stock updated",
      data: completed,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Complete sale error:", error.message);
    res.status(500).json({ success: false, message: "Server error while completing sale" });
  } finally {
    await session.endSession();
  }
}

// POST /api/v1/sales/:id/cancel: শুধু খসড়া বাতিল হয়
export async function cancelSale(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const sale = await Sale.findOneAndUpdate(
      { _id: id, status: "DRAFT" },
      { status: "CANCELLED" },
      { returnDocument: "after" }
    );

    if (!sale) {
      const exists = await Sale.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ success: false, message: "Sale not found" });
      }
      return res.status(409).json({
        success: false,
        message: "Only draft sales can be cancelled. Completed sales need a return.",
      });
    }

    await logAudit({
      userId: req.user._id,
      action: "CANCEL",
      entityType: "Sale",
      entityId: sale._id,
      summary: `Cancelled sale ${sale.saleNumber}`,
    });

    res.status(200).json({ success: true, message: "Sale cancelled", data: sale });
  } catch (error) {
    console.error("Cancel sale error:", error.message);
    res.status(500).json({ success: false, message: "Server error while cancelling sale" });
  }
}
