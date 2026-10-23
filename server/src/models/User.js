import mongoose from "mongoose";

export const ROLES = ["ADMINISTRATOR", "MANAGER", "STAFF"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "STAFF" },
    isActive: { type: Boolean, default: true },
    // নতুন user প্রথমবার login করে নিজের password বদলাতে বাধ্য হবে
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
