import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Brand = mongoose.model("Brand", brandSchema);

export default Brand;
