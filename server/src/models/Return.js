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
    // মূল বিক্রির ক্রয়মূল্য। গ্রাহকের ফেরতে লাভ থেকে এটা বাদ যাবে
    costPrice: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    kind: { type: String, required: true, enum: RETURN_KINDS, index: true },
    // গ্রাহকের ফেরতের জন্য বিক্রি, সরবরাহকারীকে ফেরতের জন্য ক্রয়
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    items: {
      type: [returnItemSchema],
      validate: { validator: (items) => items.length > 0, message: "At least one item is required" },
    },
    totalValue: { type: Number, required: true, min: 0 },
    // ফেরতের মূল্যের যে অংশ বাকি কমাল (শুধু গ্রাহকের ফেরত)
    creditApplied: { type: Number, default: 0, min: 0 },
    // বাকির বেশি অংশ যা নগদে ফেরত গেল (শুধু গ্রাহকের ফেরত)
    cashRefund: { type: Number, default: 0, min: 0 },
    // নগদ ফেরত দিলে কোন পদ্ধতিতে দেওয়া হলো
    refundMethod: { type: String, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Return = mongoose.model("Return", returnSchema);

export default Return;
