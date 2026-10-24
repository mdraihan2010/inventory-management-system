import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // কেনার সময়ের নাম ও SKU রাখা হচ্ছে, পরে পণ্যের নাম বদলালেও পুরনো রেকর্ড ঠিক থাকবে
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
    // সরবরাহকারীকে ফেরত দেওয়া পণ্যের মোট মূল্য। grandTotal বদলায় না
    returnedAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["DRAFT", "COMPLETED", "CANCELLED"], default: "DRAFT" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
