import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./Payment.js";

// Money we pay to a supplier for a completed purchase.
// Kept apart from Payment, which is money we receive from customers
const supplierPaymentSchema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
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

const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);

export default SupplierPayment;
