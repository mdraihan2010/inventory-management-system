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
    // Purchase cost of the original sale. For customer returns, this is removed from profit
    costPrice: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    kind: { type: String, required: true, enum: RETURN_KINDS, index: true },
    // For customer returns, the sale; for returns to suppliers, the purchase
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    items: {
      type: [returnItemSchema],
      validate: { validator: (items) => items.length > 0, message: "At least one item is required" },
    },
    totalValue: { type: Number, required: true, min: 0 },
    // The part of the return value that reduced the balance (customer returns only)
    creditApplied: { type: Number, default: 0, min: 0 },
    // The part above the balance that was refunded in cash (customer returns only)
    cashRefund: { type: Number, default: 0, min: 0 },
    // The method used for the cash refund
    refundMethod: { type: String, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Return = mongoose.model("Return", returnSchema);

export default Return;
