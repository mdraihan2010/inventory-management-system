import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 50 },
    barcode: {
      type: String,
      trim: true,
      default: null,
      // An empty barcode is stored as null, so several products can have no barcode without a conflict
      set: (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
    purchasePrice: { type: Number, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    currentStock: { type: Number, min: 0, default: 0 },
    minStockLevel: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: "pcs", maxlength: 20 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Barcode must be unique, but null or empty values are not checked by this rule
productSchema.index(
  { barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string" } } }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
