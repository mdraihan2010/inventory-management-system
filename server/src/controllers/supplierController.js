import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getSuppliers(req, res) {
  try {
    const filter = {};

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ name: pattern }, { companyName: pattern }, { phone: pattern }, { email: pattern }];
    }

    const suppliers = await Supplier.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, count: suppliers.length, data: suppliers });
  } catch (error) {
    console.error("Get suppliers error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching suppliers" });
  }
}

export async function createSupplier(req, res) {
  try {
    const body = req.body || {};

    if (typeof body.name !== "string" || !body.name.trim()) {
      return res.status(400).json({ success: false, message: "Supplier name is required" });
    }

    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const supplier = await Supplier.create({
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      email: body.email,
      address: body.address,
      notes: body.notes,
    });

    res.status(201).json({ success: true, message: "Supplier created", data: supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create supplier error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating supplier" });
  }
}

export async function updateSupplier(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid supplier id" });
    }

    const body = req.body || {};

    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const allowed = {};
    for (const field of ["name", "companyName", "phone", "email", "address", "notes", "isActive"]) {
      if (body[field] !== undefined) {
        allowed[field] = body[field];
      }
    }

    const supplier = await Supplier.findByIdAndUpdate(id, allowed, {
      new: true,
      runValidators: true,
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    res.status(200).json({ success: true, message: "Supplier updated", data: supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Update supplier error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating supplier" });
  }
}
