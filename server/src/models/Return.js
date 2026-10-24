import mongoose from "mongoose";

export const RETURN_KINDS = ["CUSTOMER", "SUPPLIER"];

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    // মূল বিক্রির ক্রয়মূল্য। ফেরত দিলে লাভ থেকে এটা বাদ যাবে
    costPrice: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    kind: { type: String, required: true, enum: RETURN_KINDS, index: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    items: {
      type: [returnItemSchema],
      validate: { validator: (items) => items.length > 0, message: "At least one item is required" },
    },
    totalValue: { type: Number, required: true, min: 0 },
    // ফেরতের মূল্যের যে অংশ বাকি কমাল
    creditApplied: { type: Number, default: 0, min: 0 },
    // বাকির বেশি অংশ যা নগদে ফেরত গেল
    cashRefund: { type: Number, default: 0, min: 0 },
    // নগদ ফেরত দিলে কোন পদ্ধতিতে দেওয়া হলো (CASH, MOBILE_BANKING ইত্যাদি)
    refundMethod: { type: String, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Return = mongoose.model("Return", returnSchema);

export default Return;
