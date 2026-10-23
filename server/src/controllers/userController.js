import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User, { ROLES } from "../models/User.js";

// GET /api/v1/users: সব user, passwordHash ছাড়া
export async function getUsers(req, res) {
  try {
    const users = await User.find().sort({ name: 1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error("Get users error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching users" });
  }
}

// POST /api/v1/users: নতুন user, Administrator তৈরি করে
export async function createUser(req, res) {
  try {
    const body = req.body || {};

    if (typeof body.name !== "string" || !body.name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (typeof body.email !== "string" || !/^\S+@\S+\.\S+$/.test(body.email)) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }
    if (typeof body.password !== "string" || body.password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }
    if (!ROLES.includes(body.role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(", ")}` });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role,
      isActive: true,
      mustChangePassword: true,
    });

    res.status(201).json({ success: true, message: "User created", data: user });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create user error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating user" });
  }
}

// PATCH /api/v1/users/:id: role বা active অবস্থা বদলানো
export async function updateUser(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const body = req.body || {};
    const allowed = {};

    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) {
        return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(", ")}` });
      }
      allowed.role = body.role;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return res.status(400).json({ success: false, message: "isActive must be true or false" });
      }
      allowed.isActive = body.isActive;
    }

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    // নিজেকে বন্ধ বা role কমাতে দেওয়া হবে না, যাতে কেউ সবাইকে বাদ দিয়ে ফেলতে না পারে
    if (id === req.user._id.toString()) {
      if (allowed.isActive === false) {
        return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
      }
      if (allowed.role && allowed.role !== "ADMINISTRATOR") {
        return res.status(400).json({ success: false, message: "You cannot remove your own administrator role" });
      }
    }

    const user = await User.findByIdAndUpdate(id, allowed, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "User updated", data: user });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Update user error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating user" });
  }
}

// POST /api/v1/users/change-password: নিজের password বদলানো
export async function changePassword(req, res) {
  try {
    const body = req.body || {};

    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      return res.status(400).json({ success: false, message: "Current and new password are required" });
    }
    if (body.newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    if (body.newPassword === body.currentPassword) {
      return res.status(400).json({ success: false, message: "New password must be different" });
    }

    const user = await User.findById(req.user._id).select("+passwordHash");

    const matches = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(body.newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    res.status(200).json({ success: true, message: "Password changed" });
  } catch (error) {
    console.error("Change password error:", error.message);
    res.status(500).json({ success: false, message: "Server error while changing password" });
  }
}
