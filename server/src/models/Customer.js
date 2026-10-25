import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      // So that an empty email does not fail the unique rule
      set: (value) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined),
    },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
