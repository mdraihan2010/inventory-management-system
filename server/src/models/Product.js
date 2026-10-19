import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 50 },
    barcode: {
      type: String,
      trim: true,
      default: null,
      // খালি barcode কে null হিসেবে রাখা হয়, যাতে একাধিক product-এ খালি থাকলেও সমস্যা না হয়
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

// Barcode unique থাকবে, কিন্তু null বা খালি মান এই নিয়মে ধরা হবে না
productSchema.index(
  { barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string" } } }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
