import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, required: true, unique: true },
    // customer না থাকলে walk-in বিক্রি
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    items: {
      type: [saleItemSchema],
      validate: { validator: (items) => items.length > 0, message: "At least one item is required" },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    outstandingAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ["PAID", "PARTIALLY_PAID", "UNPAID"], default: "UNPAID" },
    status: { type: String, enum: ["DRAFT", "COMPLETED", "CANCELLED"], default: "DRAFT" },
    saleDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
