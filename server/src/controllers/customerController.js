import mongoose from "mongoose";
import Customer from "../models/Customer.js";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getCustomers(req, res) {
  try {
    const filter = {};

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }];
    }

    const customers = await Customer.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, count: customers.length, data: customers });
  } catch (error) {
    console.error("Get customers error:", error.message);
    res.status(500).json({ success: false, message: "Server error while fetching customers" });
  }
}

export async function createCustomer(req, res) {
  try {
    const body = req.body || {};

    if (typeof body.name !== "string" || !body.name.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }

    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const customer = await Customer.create({
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address,
      notes: body.notes,
    });

    res.status(201).json({ success: true, message: "Customer created", data: customer });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create customer error:", error.message);
    res.status(500).json({ success: false, message: "Server error while creating customer" });
  }
}

export async function updateCustomer(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid customer id" });
    }

    const body = req.body || {};

    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const allowed = {};
    for (const field of ["name", "phone", "email", "address", "notes", "isActive"]) {
      if (body[field] !== undefined) {
        allowed[field] = body[field];
      }
    }

    const customer = await Customer.findByIdAndUpdate(id, allowed, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.status(200).json({ success: true, message: "Customer updated", data: customer });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Update customer error:", error.message);
    res.status(500).json({ success: false, message: "Server error while updating customer" });
  }
}
