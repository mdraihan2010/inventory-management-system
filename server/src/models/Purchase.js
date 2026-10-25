import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // The name and SKU at the time of purchase are stored, so old records stay correct if the product is renamed later
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    purchaseDate: { type: Date, default: Date.now },
    items: {
      type: [purchaseItemSchema],
      validate: { validator: (items) => items.length > 0, message: "At least one item is required" },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    // Total value of products returned to the supplier. grandTotal does not change
    returnedAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["DRAFT", "COMPLETED", "CANCELLED"], default: "DRAFT" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
