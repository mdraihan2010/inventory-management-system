import mongoose from "mongoose";
import Category from "../models/Category.js";

// সব category দেখায়, নাম অনুযায়ী সাজানো
export async function getCategories(req, res) {
  try {
    const categories = await Category.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching categories" });
  }
}

// নতুন category তৈরি করে
export async function createCategory(req, res) {
  try {
    // Express 5-এ body না থাকলে req.body undefined হয়, তাই এই সুরক্ষা
    const body = req.body || {};
    const { name, description } = body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const category = await Category.create({ name, description });

    res.status(201).json({ success: true, message: "Category created", data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    console.error("Create category error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating category" });
  }
}

// category আপডেট করে, বা বন্ধ/চালু করে
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    const body = req.body || {};

    // শুধু এই তিনটা field বদলানো যাবে, অন্য কিছু নয়
    const allowed = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.description !== undefined) allowed.description = body.description;
    if (body.isActive !== undefined) allowed.isActive = body.isActive;

    const category = await Category.findByIdAndUpdate(id, allowed, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.status(200).json({ success: true, message: "Category updated", data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    console.error("Update category error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating category" });
  }
}
