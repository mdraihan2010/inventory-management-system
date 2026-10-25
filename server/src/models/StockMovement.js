import mongoose from "mongoose";

export const MOVEMENT_TYPES = [
  "OPENING_STOCK",
  "PURCHASE",
  "SALE",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "DAMAGED",
  "ADJUSTMENT",
];

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, required: true, enum: MOVEMENT_TYPES },
    // A positive value means stock increased, a negative value means it decreased. A value of 0 has no meaning for a record
    change: {
      type: Number,
      required: true,
      validate: { validator: (value) => value !== 0, message: "Change cannot be zero" },
    },
    previousStock: { type: Number, required: true, min: 0 },
    resultingStock: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 300, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

export default StockMovement;
