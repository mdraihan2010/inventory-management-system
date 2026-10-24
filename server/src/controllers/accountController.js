import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import { logAudit } from "../utils/auditLogger.js";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function normaliseEmail(value) {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

// নিজের email বদলানো। বর্তমান password লাগবে, যাতে অন্য কেউ এসে email না বদলাতে পারে
export async function changeOwnEmail(req, res) {
  try {
    const body = req.body || {};
    const newEmail = normaliseEmail(body.newEmail);

    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      return res.status(400).json({ success: false, message: "Current password is required" });
    }
    if (!EMAIL_PATTERN.test(newEmail)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const matches = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    if (newEmail === user.email) {
      return res.status(400).json({ success: false, message: "This is already your email" });
    }

    const taken = await User.exists({ email: newEmail, _id: { $ne: user._id } });
    if (taken) {
      return res.status(409).json({ success: false, message: "This email is already used by another user" });
    }

    user.email = newEmail;
    await user.save();

    await logAudit({
      userId: req.user._id,
      action: "UPDATE",
      entityType: "User",
      entityId: user._id,
      summary: "User changed own email",
    });

    res.status(200).json({ success: true, message: "Email changed", data: { email: user.email } });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Change email error:", error.message);
    res.status(500).json({ success: false, message: "Server error while changing email" });
  }
}

// Administrator অন্য ব্যবহারকারীর নাম বা email বদলাবে
export async function updateUserProfile(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return res.status(400).json({ success: false, message: "Name cannot be empty" });
      }
      updates.name = name;
    }

    if (body.email !== undefined) {
      const email = normaliseEmail(body.email);
      if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, message: "Enter a valid email address" });
      }
      const taken = await User.exists({ email, _id: { $ne: id } });
      if (taken) {
        return res.status(409).json({ success: false, message: "This email is already used by another user" });
      }
      updates.email = email;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await logAudit({
      userId: req.user._id,
      action: "UPDATE",
      entityType: "User",
      entityId: user._id,
      summary: `Updated profile: ${Object.keys(updates).join(", ")}`,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated",
      data: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Update profile error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating profile" });
  }
}

// Administrator অস্থায়ী password বসাবে। ব্যবহারকারী পরের login-এ নিজে বদলাতে বাধ্য হবে
export async function resetUserPassword(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  if (id === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "Use the change password option for your own account",
    });
  }

  const temporaryPassword = req.body?.temporaryPassword;
  if (typeof temporaryPassword !== "string" || temporaryPassword.length < 8) {
    return res.status(400).json({ success: false, message: "Temporary password must be at least 8 characters" });
  }

  try {
    const user = await User.findById(id).select("+passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.passwordHash = await bcrypt.hash(temporaryPassword, 12);
    user.mustChangePassword = true;
    await user.save();

    // পাসওয়ার্ডের মান রেকর্ডে যায় না, শুধু ঘটনাটি
    await logAudit({
      userId: req.user._id,
      action: "CHANGE_PASSWORD",
      entityType: "User",
      entityId: user._id,
      summary: "Administrator set a temporary password",
    });

    res.status(200).json({
      success: true,
      message: "Temporary password set. The user must change it at next login.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ success: false, message: "Server error while resetting password" });
  }
}
