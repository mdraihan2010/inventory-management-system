import crypto from "crypto";
import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import Return from "../models/Return.js";
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

// Total quantity of each product already returned to suppliers for this purchase
async function returnedToSupplier(purchaseId, session) {
  const rows = await Return.aggregate([
    { $match: { kind: "SUPPLIER", purchase: purchaseId } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", returned: { $sum: "$items.quantity" } } },
  ]).session(session);

  return new Map(rows.map((row) => [String(row._id), row.returned]));
}

// Shows how many of each product can still be returned to the supplier
export async function getReturnablePurchaseItems(req, res) {
  const { purchaseId } = req.params;

  if (!mongoose.isValidObjectId(purchaseId)) {
    return res.status(400).json({ success: false, message: "Invalid purchase id" });
  }

  try {
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const returned = await returnedToSupplier(purchase._id, null);

    const items = purchase.items.map((item) => {
      const returnedQuantity = returned.get(String(item.product)) || 0;
      return {
        productId: String(item.product),
        productName: item.productName,
        sku: item.sku,
        unitPrice: item.unitPrice,
        purchasedQuantity: item.quantity,
        returnedQuantity,
        remaining: Math.max(0, item.quantity - returnedQuantity),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        purchase: {
          _id: purchase._id,
          purchaseNumber: purchase.purchaseNumber,
          status: purchase.status,
          grandTotal: purchase.grandTotal,
          returnedAmount: purchase.returnedAmount || 0,
        },
        items,
      },
    });
  } catch (error) {
    console.error("Returnable purchase items error:", error.message);
    res.status(500).json({ success: false, message: "Server error while loading returnable items" });
  }
}

// Return to supplier: products are sent back and stock decreases. There is no cash transaction with the supplier
export async function createSupplierReturn(req, res) {
  const body = req.body || {};

  if (!mongoose.isValidObjectId(body.purchaseId)) {
    return res.status(400).json({ success: false, message: "Invalid purchase id" });
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
      const purchase = await Purchase.findById(body.purchaseId).session(session);
      if (!purchase) {
        throw httpError(404, "Purchase not found");
      }
      if (purchase.status !== "COMPLETED") {
        throw httpError(409, "Returns to supplier can only be made for completed purchases");
      }

      const alreadyReturned = await returnedToSupplier(purchase._id, session);

      // The price and limit come from the purchase record, not from the price the user sends
      const lines = body.items.map((requested) => {
        const purchaseItem = purchase.items.find((item) => String(item.product) === requested.productId);
        if (!purchaseItem) {
          throw httpError(400, `Product ${requested.productId} is not part of this purchase`);
        }

        const remaining = purchaseItem.quantity - (alreadyReturned.get(requested.productId) || 0);
        if (requested.quantity > remaining) {
          throw httpError(409, `${purchaseItem.productName}: you can return at most ${remaining}`);
        }

        return {
          product: purchaseItem.product,
          productName: purchaseItem.productName,
          sku: purchaseItem.sku,
          quantity: requested.quantity,
          unitPrice: purchaseItem.unitPrice,
          lineTotal: roundMoney(requested.quantity * purchaseItem.unitPrice),
          costPrice: null,
        };
      });

      const totalValue = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));

      // Decrease stock. If there is not enough stock, the whole return is cancelled
      for (const line of lines) {
        const product = await Product.findOneAndUpdate(
          { _id: line.product, currentStock: { $gte: line.quantity } },
          { $inc: { currentStock: -line.quantity } },
          { new: true, session }
        );

        if (!product) {
          const existing = await Product.findById(line.product).session(session);
          if (!existing) {
            throw httpError(404, `Product ${line.productName} not found`);
          }
          throw httpError(
            409,
            `${line.productName}: not enough stock to return (current stock ${existing.currentStock})`
          );
        }

        await StockMovement.create(
          [
            {
              product: line.product,
              type: "SUPPLIER_RETURN",
              change: -line.quantity,
              previousStock: product.currentStock + line.quantity,
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
            kind: "SUPPLIER",
            purchase: purchase._id,
            supplier: purchase.supplier,
            items: lines,
            totalValue,
            creditApplied: 0,
            cashRefund: 0,
            refundMethod: null,
            reason: body.reason.trim(),
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      purchase.returnedAmount = roundMoney((purchase.returnedAmount || 0) + totalValue);
      await purchase.save({ session });

      result = { returnDoc, purchase };
    });

    // Financial decision: write the record after the transaction succeeds
    await logAudit({
      userId: req.user._id,
      action: "SUPPLIER_RETURN",
      entityType: "Return",
      entityId: result.returnDoc._id,
      summary: `Supplier return ${returnNumber} of ${result.returnDoc.totalValue} for purchase ${result.purchase.purchaseNumber}`,
    });

    res.status(201).json({
      success: true,
      message: "Supplier return recorded and stock updated",
      data: {
        return: result.returnDoc,
        purchase: {
          _id: result.purchase._id,
          purchaseNumber: result.purchase.purchaseNumber,
          returnedAmount: result.purchase.returnedAmount,
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
    console.error("Supplier return error:", error.message);
    res.status(500).json({ success: false, message: "Server error while recording supplier return" });
  } finally {
    await session.endSession();
  }
}
