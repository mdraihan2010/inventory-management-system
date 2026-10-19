import mongoose from "mongoose";
import Payment, { PAYMENT_METHODS } from "../models/Payment.js";
import Sale from "../models/Sale.js";

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// POST /api/v1/sales/:id/payments: একটা বিক্রিতে নতুন পরিশোধ যোগ করা
export async function addPayment(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid sale id" });
  }

  const body = req.body || {};

  if (typeof body.amount !== "number" || !(body.amount > 0)) {
    return res.status(400).json({ success: false, message: "Amount must be greater than zero" });
  }

  if (!PAYMENT_METHODS.includes(body.method)) {
    return res.status(400).json({
      success: false,
      message: `Method must be one of: ${PAYMENT_METHODS.join(", ")}`,
    });
  }

  const amount = roundMoney(body.amount);
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // শর্তসহ বাড়ানো: শুধু COMPLETED বিক্রি এবং যথেষ্ট বাকি থাকলেই হবে
      const sale = await Sale.findOneAndUpdate(
        {
          _id: id,
          status: "COMPLETED",
          outstandingAmount: { $gte: amount },
        },
        [
          {
            $set: {
              paidAmount: { $round: [{ $add: ["$paidAmount", amount] }, 2] },
              outstandingAmount: { $round: [{ $subtract: ["$outstandingAmount", amount] }, 2] },
            },
          },
          {
            $set: {
              paymentStatus: {
                $cond: [{ $lte: ["$outstandingAmount", 0] }, "PAID", "PARTIALLY_PAID"],
              },
            },
          },
        ],
        { new: true, session, updatePipeline: true }
      );

      if (!sale) {
        const existing = await Sale.findById(id).session(session);
        if (!existing) {
          throw httpError(404, "Sale not found");
        }
        if (existing.status !== "COMPLETED") {
          throw httpError(409, "Payments can only be added to completed sales");
        }
        throw httpError(409, `Amount exceeds the outstanding balance of ${existing.outstandingAmount}`);
      }

      const [payment] = await Payment.create(
        [
          {
            sale: sale._id,
            customer: sale.customer,
            amount,
            method: body.method,
            reference: body.reference,
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      result = { sale, payment };
    });

    res.status(201).json({
      success: true,
      message: "Payment recorded",
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Add payment error:", error.message);
    res.status(500).json({ success: false, message: "Server error while recording payment" });
  } finally {
    await session.endSession();
  }
}

// GET /api/v1/sales/:id/payments: একটা বিক্রির সব পরিশোধ
export async function getSalePayments(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const payments = await Payment.find({ sale: id })
      .populate("createdBy", "name")
      .sort({ createdAt: 1 });

    const totalPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));

    res.status(200).json({
      success: true,
      count: payments.length,
      totalPaid,
      data: payments,
    });
  } catch (error) {
    console.error("Get payments error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching payments" });
  }
}

// GET /api/v1/payments: সব পরিশোধ, নতুনটা আগে
export async function getAllPayments(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const [payments, total] = await Promise.all([
      Payment.find()
        .populate("sale", "saleNumber grandTotal")
        .populate("customer", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: payments,
    });
  } catch (error) {
    console.error("Get all payments error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching payments" });
  }
}

