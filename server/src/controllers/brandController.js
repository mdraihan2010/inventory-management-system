import mongoose from "mongoose";
import Brand from "../models/Brand.js";

export async function getBrands(req, res) {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.status(200).json({ success: true, count: brands.length, data: brands });
  } catch (error) {
    console.error("Get brands error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching brands" });
  }
}

export async function createBrand(req, res) {
  try {
    const body = req.body || {};
    const { name, description } = body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Brand name is required" });
    }

    const brand = await Brand.create({ name, description });
    res.status(201).json({ success: true, message: "Brand created", data: brand });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Brand name already exists" });
    }
    console.error("Create brand error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating brand" });
  }
}

export async function updateBrand(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid brand id" });
    }

    const body = req.body || {};
    const allowed = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.description !== undefined) allowed.description = body.description;
    if (body.isActive !== undefined) allowed.isActive = body.isActive;

    const brand = await Brand.findByIdAndUpdate(id, allowed, {
      new: true,
      runValidators: true,
    });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.status(200).json({ success: true, message: "Brand updated", data: brand });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Brand name already exists" });
    }
    console.error("Update brand error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating brand" });
  }
}
