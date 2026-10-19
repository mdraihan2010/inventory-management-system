import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";

// নির্দিষ্ট status সহ error তৈরি করে, যাতে সঠিক উত্তর পাঠানো যায়
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// চালান সম্পন্ন করার মূল কাজ। এটা একটা transaction-এর ভিতরে চলবে
async function completeInsideTransaction(purchaseId, userId, session) {
  // ১. শর্তসহ বদল: শুধু DRAFT চালানই COMPLETED হবে। দুবার সম্পন্ন হওয়া এখানেই আটকায়
  const purchase = await Purchase.findOneAndUpdate(
    { _id: purchaseId, status: "DRAFT" },
    { status: "COMPLETED" },
    { new: true, session }
  );

  if (!purchase) {
    const exists = await Purchase.exists({ _id: purchaseId }).session(session);
    if (!exists) {
      throw httpError(404, "Purchase not found");
    }
    throw httpError(409, "Only draft purchases can be completed");
  }

  // ২. প্রতিটি পণ্যের স্টক বাড়াও, এবং প্রতিটির জন্য রেকর্ড রাখো
  for (const item of purchase.items) {
    const product = await Product.findOneAndUpdate(
      { _id: item.product },
      { $inc: { currentStock: item.quantity } },
      { new: true, session }
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

    // এই ব্লকের সব কাজ একসাথে হবে, নয়তো কিছুই হবে না
    await session.withTransaction(async () => {
      completed = await completeInsideTransaction(id, req.user._id, session);
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
      { new: true }
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

    res.status(200).json({ success: true, message: "Purchase cancelled", data: purchase });
  } catch (error) {
    console.error("Cancel purchase error:", error.message);
    res.status(500).json({ success: false, message: "Server error while cancelling purchase" });
  }
}
