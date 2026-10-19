import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    companyName: { type: String, trim: true, maxlength: 150, default: "" },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      set: (value) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined),
    },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

const Supplier = mongoose.model("Supplier", supplierSchema);

export default Supplier;
