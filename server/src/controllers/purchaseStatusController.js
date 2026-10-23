import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { logAudit } from "../utils/auditLogger.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function completeInsideTransaction(purchaseId, userId, session) {
  const purchase = await Purchase.findOneAndUpdate(
    { _id: purchaseId, status: "DRAFT" },
    { status: "COMPLETED" },
    { returnDocument: "after", session }
  );

  if (!purchase) {
    const exists = await Purchase.exists({ _id: purchaseId }).session(session);
    if (!exists) {
      throw httpError(404, "Purchase not found");
    }
    throw httpError(409, "Only draft purchases can be completed");
  }

  for (const item of purchase.items) {
    const product = await Product.findOneAndUpdate(
      { _id: item.product },
      { $inc: { currentStock: item.quantity } },
      { returnDocument: "after", session }
    );

    if (!product) {
      throw httpError(400, `Product not found: ${item.productName}`);
    }

    const resultingStock = product.currentStock;
    const previousStock = resultingStock - item.quantity;

    await StockMovement.create(
      [
        {
          product: product._id,
          type: "PURCHASE",
          change: item.quantity,
          previousStock,
          resultingStock,
          reason: `Purchase ${purchase.purchaseNumber}`,
          createdBy: userId,
        },
      ],
      { session }
    );
  }

  return purchase;
}

// POST /api/v1/purchases/:id/complete
export async function completePurchase(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid purchase id" });
  }

  const session = await mongoose.startSession();

  try {
    let completed;

    await session.withTransaction(async () => {
      completed = await completeInsideTransaction(id, req.user._id, session);
    });

    // আর্থিক সিদ্ধান্ত: মাল গ্রহণ ও স্টক বাড়ানো
    await logAudit({
      userId: req.user._id,
      action: "COMPLETE",
      entityType: "Purchase",
      entityId: completed._id,
      summary: `Completed purchase ${completed.purchaseNumber} for ${completed.grandTotal}`,
    });

    res.status(200).json({
      success: true,
      message: "Purchase completed and stock updated",
      data: completed,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Complete purchase error:", error.message);
    res.status(500).json({ success: false, message: "Server error while completing purchase" });
  } finally {
    await session.endSession();
  }
}

// POST /api/v1/purchases/:id/cancel
export async function cancelPurchase(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase id" });
    }

    const purchase = await Purchase.findOneAndUpdate(
      { _id: id, status: "DRAFT" },
      { status: "CANCELLED" },
      { returnDocument: "after" }
    );

    if (!purchase) {
      const exists = await Purchase.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ success: false, message: "Purchase not found" });
      }
      return res.status(409).json({
        success: false,
        message: "Only draft purchases can be cancelled. Completed purchases need a reversal.",
      });
    }

    await logAudit({
      userId: req.user._id,
      action: "CANCEL",
      entityType: "Purchase",
      entityId: purchase._id,
      summary: `Cancelled purchase ${purchase.purchaseNumber}`,
    });

    res.status(200).json({ success: true, message: "Purchase cancelled", data: purchase });
  } catch (error) {
    console.error("Cancel purchase error:", error.message);
    res.status(500).json({ success: false, message: "Server error while cancelling purchase" });
  }
}
