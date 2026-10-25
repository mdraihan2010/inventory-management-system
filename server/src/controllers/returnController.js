import crypto from "crypto";
import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import Return from "../models/Return.js";
import { PAYMENT_METHODS } from "../models/Payment.js";
import { logAudit } from "../utils/auditLogger.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function newReturnNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RET-${date}-${random}`;
}

// Total quantity of each product already returned by customers for this sale
async function returnedQuantities(saleId, session) {
  const rows = await Return.aggregate([
    { $match: { kind: "CUSTOMER", sale: saleId } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", returned: { $sum: "$items.quantity" } } },
  ]).session(session);

  return new Map(rows.map((row) => [String(row._id), row.returned]));
}

// Shows how many of each product can still be returned
export async function getReturnableItems(req, res) {
  const { saleId } = req.params;

  if (!mongoose.isValidObjectId(saleId)) {
    return res.status(400).json({ success: false, message: "Invalid sale id" });
  }

  try {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const returned = await returnedQuantities(sale._id, null);

    const items = sale.items.map((item) => {
      const returnedQuantity = returned.get(String(item.product)) || 0;
      return {
        productId: String(item.product),
        productName: item.productName,
        sku: item.sku,
        unitPrice: item.unitPrice,
        soldQuantity: item.quantity,
        returnedQuantity,
        remaining: Math.max(0, item.quantity - returnedQuantity),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        sale: {
          _id: sale._id,
          saleNumber: sale.saleNumber,
          status: sale.status,
          grandTotal: sale.grandTotal,
          paidAmount: sale.paidAmount,
          outstandingAmount: sale.outstandingAmount,
          returnedAmount: sale.returnedAmount || 0,
        },
        items,
      },
    });
  } catch (error) {
    console.error("Returnable items error:", error.message);
    res.status(500).json({ success: false, message: "Server error while loading returnable items" });
  }
}

// Customer return: products come back, stock increases, the balance decreases, and any amount above the balance is refunded in cash
export async function createCustomerReturn(req, res) {
  const body = req.body || {};

  if (!mongoose.isValidObjectId(body.saleId)) {
    return res.status(400).json({ success: false, message: "Invalid sale id" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ success: false, message: "At least one item is required" });
  }

  const seen = new Set();
  for (const item of body.items) {
    if (!mongoose.isValidObjectId(item.productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive whole number" });
    }
    if (seen.has(item.productId)) {
      return res.status(400).json({ success: false, message: "The same product cannot be listed twice" });
    }
    seen.add(item.productId);
  }

  if (typeof body.reason !== "string" || !body.reason.trim()) {
    return res.status(400).json({ success: false, message: "A reason is required for a return" });
  }

  const returnNumber = newReturnNumber();
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(body.saleId).session(session);
      if (!sale) {
        throw httpError(404, "Sale not found");
      }
      if (sale.status !== "COMPLETED") {
        throw httpError(409, "Returns can only be made for completed sales");
      }

      const alreadyReturned = await returnedQuantities(sale._id, session);

      // The price and limit of each line come from the sale record, not from the price the user sends
      const lines = body.items.map((requested) => {
        const saleItem = sale.items.find((item) => String(item.product) === requested.productId);
        if (!saleItem) {
          throw httpError(400, `Product ${requested.productId} is not part of this sale`);
        }

        const remaining = saleItem.quantity - (alreadyReturned.get(requested.productId) || 0);
        if (requested.quantity > remaining) {
          throw httpError(409, `${saleItem.productName}: you can return at most ${remaining}`);
        }

        return {
          product: saleItem.product,
          productName: saleItem.productName,
          sku: saleItem.sku,
          quantity: requested.quantity,
          unitPrice: saleItem.unitPrice,
          lineTotal: roundMoney(requested.quantity * saleItem.unitPrice),
          costPrice: saleItem.costPrice ?? null,
        };
      });

      const totalValue = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));

      // The balance is reduced first. Any amount above the balance is refunded in cash
      const creditApplied = roundMoney(Math.min(totalValue, sale.outstandingAmount));
      const cashRefund = roundMoney(totalValue - creditApplied);

      if (cashRefund > 0 && !PAYMENT_METHODS.includes(body.refundMethod)) {
        throw httpError(400, `Refund method is required when cash is refunded. Use one of: ${PAYMENT_METHODS.join(", ")}`);
      }

      // Increase stock and keep the records
      for (const line of lines) {
        const product = await Product.findByIdAndUpdate(
          line.product,
          { $inc: { currentStock: line.quantity } },
          { new: true, session }
        );
        if (!product) {
          throw httpError(404, `Product ${line.productName} not found`);
        }

        await StockMovement.create(
          [
            {
              product: line.product,
              type: "CUSTOMER_RETURN",
              change: line.quantity,
              previousStock: product.currentStock - line.quantity,
              resultingStock: product.currentStock,
              reason: `Return ${returnNumber}`,
              createdBy: req.user._id,
            },
          ],
          { session }
        );
      }

      const [returnDoc] = await Return.create(
        [
          {
            returnNumber,
            kind: "CUSTOMER",
            sale: sale._id,
            customer: sale.customer,
            items: lines,
            totalValue,
            creditApplied,
            cashRefund,
            refundMethod: cashRefund > 0 ? body.refundMethod : null,
            reason: body.reason.trim(),
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      sale.outstandingAmount = roundMoney(sale.outstandingAmount - creditApplied);
      sale.returnedAmount = roundMoney((sale.returnedAmount || 0) + totalValue);
      sale.paymentStatus =
        sale.outstandingAmount <= 0 ? "PAID" : sale.paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";
      await sale.save({ session });

      result = { returnDoc, sale };
    });

    // Financial decision: write the record after the transaction succeeds
    await logAudit({
      userId: req.user._id,
      action: "CUSTOMER_RETURN",
      entityType: "Return",
      entityId: result.returnDoc._id,
      summary: `Customer return ${returnNumber} of ${result.returnDoc.totalValue} for sale ${result.sale.saleNumber}`,
    });

    res.status(201).json({
      success: true,
      message: "Customer return recorded and stock updated",
      data: {
        return: result.returnDoc,
        sale: {
          _id: result.sale._id,
          saleNumber: result.sale.saleNumber,
          outstandingAmount: result.sale.outstandingAmount,
          returnedAmount: result.sale.returnedAmount,
          paymentStatus: result.sale.paymentStatus,
        },
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Customer return error:", error.message);
    res.status(500).json({ success: false, message: "Server error while recording return" });
  } finally {
    await session.endSession();
  }
}

// Return list, with pagination। গ্রাহক, সরবরাহকারী, বিক্রি ও ক্রয়ের নাম সহ
export async function getReturns(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = {};

  if (req.query.kind) {
    if (!["CUSTOMER", "SUPPLIER"].includes(req.query.kind)) {
      return res.status(400).json({ success: false, message: "Kind must be CUSTOMER or SUPPLIER" });
    }
    filter.kind = req.query.kind;
  }

  try {
    const [data, total] = await Promise.all([
      Return.find(filter)
        .populate("sale", "saleNumber")
        .populate("purchase", "purchaseNumber")
        .populate("customer", "name")
        .populate("supplier", "name companyName")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Return.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data,
    });
  } catch (error) {
    console.error("Get returns error:", error.message);
    res.status(500).json({ success: false, message: "Server error while loading returns" });
  }
}
