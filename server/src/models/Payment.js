import mongoose from "mongoose";

export const PAYMENT_METHODS = ["CASH", "MOBILE_BANKING", "CARD", "BANK_TRANSFER"];

const paymentSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    amount: {
      type: Number,
      required: true,
      validate: { validator: (value) => value > 0, message: "Amount must be greater than zero" },
    },
    method: { type: String, required: true, enum: PAYMENT_METHODS },
    reference: { type: String, trim: true, maxlength: 100, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
