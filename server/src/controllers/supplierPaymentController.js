import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import SupplierPayment from "../models/SupplierPayment.js";
import { PAYMENT_METHODS } from "../models/Payment.js";
import { logAudit } from "../utils/auditLogger.js";

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// What we still owe for a purchase: the bill, minus products sent back, minus what was already paid
export function purchaseOutstanding(purchase) {
  return roundMoney(
    Math.max(0, purchase.grandTotal - (purchase.returnedAmount || 0) - (purchase.paidAmount || 0))
  );
}

// POST /api/v1/purchases/:id/payments: records money paid to the supplier of a purchase
export async function addSupplierPayment(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid purchase id" });
  }
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || !(body.amount > 0)) {
    return res.status(400).json({ success: false, message: "Amount must be greater than zero" });
  }
  if (!PAYMENT_METHODS.includes(body.method)) {
    return res.status(400).json({
      success: false,
      message: `Method must be one of: ${PAYMENT_METHODS.join(", ")}`,
    });
  }
  if (body.reference !== undefined && (typeof body.reference !== "string" || body.reference.length > 100)) {
    return res.status(400).json({ success: false, message: "Reference must be text of 100 characters or fewer" });
  }

  const amount = roundMoney(body.amount);
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // The amount is added only if the purchase is completed and the payment does not go above
      // what is still owed. Checking and updating in one step stops two payments from overpaying together
      const purchase = await Purchase.findOneAndUpdate(
        {
          _id: id,
          status: "COMPLETED",
          $expr: {
            $lte: [
              { $round: [{ $add: [{ $ifNull: ["$paidAmount", 0] }, amount] }, 2] },
              { $round: [{ $subtract: ["$grandTotal", { $ifNull: ["$returnedAmount", 0] }] }, 2] },
            ],
          },
        },
        [{ $set: { paidAmount: { $round: [{ $add: [{ $ifNull: ["$paidAmount", 0] }, amount] }, 2] } } }],
        { returnDocument: "after", session, updatePipeline: true }
      );

      if (!purchase) {
        const existing = await Purchase.findById(id).session(session);
        if (!existing) throw httpError(404, "Purchase not found");
        if (existing.status !== "COMPLETED") {
          throw httpError(409, "Payments can only be made for completed purchases");
        }
        throw httpError(409, `Amount is more than the outstanding balance of ${purchaseOutstanding(existing)}`);
      }

      const [payment] = await SupplierPayment.create(
        [
          {
            purchase: purchase._id,
            supplier: purchase.supplier,
            amount,
            method: body.method,
            reference: body.reference ?? "",
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      result = { purchase, payment };
    });

    await logAudit({
      userId: req.user._id,
      action: "SUPPLIER_PAYMENT",
      entityType: "SupplierPayment",
      entityId: result.payment._id,
      summary: `Paid ${amount} by ${body.method} for purchase ${result.purchase.purchaseNumber}`,
    });

    res.status(201).json({
      success: true,
      message: "Supplier payment recorded",
      data: {
        payment: result.payment,
        purchase: {
          _id: result.purchase._id,
          purchaseNumber: result.purchase.purchaseNumber,
          paidAmount: result.purchase.paidAmount,
          outstandingAmount: purchaseOutstanding(result.purchase),
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
    console.error("Supplier payment error:", error.message);
    res.status(500).json({ success: false, message: "Server error while recording supplier payment" });
  } finally {
    await session.endSession();
  }
}

// GET /api/v1/purchases/:id/payments: all payments made for one purchase
export async function getPurchasePayments(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid purchase id" });
  }

  try {
    const payments = await SupplierPayment.find({ purchase: id })
      .populate("createdBy", "name")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      totalPaid: roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0)),
      data: payments,
    });
  } catch (error) {
    console.error("Get purchase payments error:", error.message);
    res.status(500).json({ success: false, message: "Server error while loading supplier payments" });
  }
}
