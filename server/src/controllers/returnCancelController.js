import mongoose from "mongoose";
import Return from "../models/Return.js";
import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { logAudit } from "../utils/auditLogger.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// Undo a customer return: the products leave stock again and the customer owes the amount again
async function undoCustomerReturn(returnDoc, userId, session) {
  for (const line of returnDoc.items) {
    const product = await Product.findOneAndUpdate(
      { _id: line.product, currentStock: { $gte: line.quantity } },
      { $inc: { currentStock: -line.quantity } },
      { returnDocument: "after", session }
    );

    if (!product) {
      const existing = await Product.findById(line.product).session(session);
      if (!existing) throw httpError(404, `Product ${line.productName} not found`);
      // The returned products were sold again, so the return can no longer be undone
      throw httpError(
        409,
        `${line.productName}: only ${existing.currentStock} in stock, ${line.quantity} needed to undo this return`
      );
    }

    await StockMovement.create(
      [
        {
          product: line.product,
          type: "RETURN_CANCELLED",
          change: -line.quantity,
          previousStock: product.currentStock + line.quantity,
          resultingStock: product.currentStock,
          reason: `Cancelled return ${returnDoc.returnNumber}`,
          createdBy: userId,
        },
      ],
      { session }
    );
  }

  const sale = await Sale.findById(returnDoc.sale).session(session);
  if (!sale) throw httpError(404, "The sale of this return was not found");

  sale.outstandingAmount = roundMoney(sale.outstandingAmount + returnDoc.creditApplied);
  sale.returnedAmount = roundMoney(Math.max(0, (sale.returnedAmount || 0) - returnDoc.totalValue));
  sale.paymentStatus =
    sale.outstandingAmount <= 0 ? "PAID" : sale.paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";
  await sale.save({ session });

  return sale.saleNumber;
}

// Undo a return to a supplier: the products come back into stock
async function undoSupplierReturn(returnDoc, userId, session) {
  for (const line of returnDoc.items) {
    const product = await Product.findByIdAndUpdate(
      line.product,
      { $inc: { currentStock: line.quantity } },
      { returnDocument: "after", session }
    );
    if (!product) throw httpError(404, `Product ${line.productName} not found`);

    await StockMovement.create(
      [
        {
          product: line.product,
          type: "RETURN_CANCELLED",
          change: line.quantity,
          previousStock: product.currentStock - line.quantity,
          resultingStock: product.currentStock,
          reason: `Cancelled return ${returnDoc.returnNumber}`,
          createdBy: userId,
        },
      ],
      { session }
    );
  }

  const purchase = await Purchase.findById(returnDoc.purchase).session(session);
  if (!purchase) throw httpError(404, "The purchase of this return was not found");

  purchase.returnedAmount = roundMoney(Math.max(0, (purchase.returnedAmount || 0) - returnDoc.totalValue));
  await purchase.save({ session });

  return purchase.purchaseNumber;
}

// POST /api/v1/returns/:id/cancel
// Cancels a return that was saved by mistake. The record stays, marked CANCELLED,
// and its stock and balance changes are reversed in one transaction
export async function cancelReturn(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid return id" });
  }
  if (typeof body.reason !== "string" || !body.reason.trim()) {
    return res.status(400).json({ success: false, message: "A reason is required to cancel a return" });
  }
  if (body.reason.trim().length > 300) {
    return res.status(400).json({ success: false, message: "The reason must be 300 characters or fewer" });
  }

  const session = await mongoose.startSession();

  try {
    let cancelled;
    let source;

    await session.withTransaction(async () => {
      const existing = await Return.findById(id).session(session);
      if (!existing) throw httpError(404, "Return not found");
      if (existing.status === "CANCELLED") throw httpError(409, "This return is already cancelled");

      // Cash that was handed back cannot be taken back by the system, so these returns stay
      if (existing.cashRefund > 0) {
        throw httpError(
          409,
          "This return included a cash refund, so it cannot be cancelled. Record a new sale for the products instead"
        );
      }

      // Marking it first, with a condition, stops two people from cancelling the same return at once
      cancelled = await Return.findOneAndUpdate(
        { _id: id, status: { $ne: "CANCELLED" } },
        {
          $set: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledBy: req.user._id,
            cancelReason: body.reason.trim(),
          },
        },
        { returnDocument: "after", session }
      );
      if (!cancelled) throw httpError(409, "This return is already cancelled");

      source =
        cancelled.kind === "CUSTOMER"
          ? await undoCustomerReturn(cancelled, req.user._id, session)
          : await undoSupplierReturn(cancelled, req.user._id, session);
    });

    await logAudit({
      userId: req.user._id,
      action: "CANCEL",
      entityType: "Return",
      entityId: cancelled._id,
      summary: `Cancelled return ${cancelled.returnNumber} of ${cancelled.totalValue} for ${source}: ${cancelled.cancelReason}`,
    });

    res.status(200).json({
      success: true,
      message: "Return cancelled. Stock and balances have been restored",
      data: cancelled,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Cancel return error:", error.message);
    res.status(500).json({ success: false, message: "Server error while cancelling return" });
  } finally {
    await session.endSession();
  }
}
