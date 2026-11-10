import "dotenv/config";
import fs from "fs";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import { logAudit } from "../utils/auditLogger.js";

// Imports customers from a CSV file. The first run only shows a preview; add --apply to save.
// Header: name,phone,email,address,notes (only name is required)

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const [csvPath, adminEmailArg] = args.filter((arg) => !arg.startsWith("--"));
const SHOW_ROWS = 20;

if (!csvPath || !adminEmailArg) {
  console.log('Usage: node src/scripts/importCustomers.js "<csv file path>" "<admin email>" [--apply]');
  process.exit(1);
}

// A simple CSV reader. It correctly keeps commas that are inside double quotes
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

await mongoose.connect(process.env.MONGO_URI);

const admin = await User.findOne({ email: adminEmailArg.toLowerCase().trim(), isActive: true });
if (!admin || !["ADMINISTRATOR", "MANAGER"].includes(admin.role)) {
  console.log("No active Administrator or Manager was found with this email.");
  await mongoose.disconnect();
  process.exit(1);
}

// Existing emails and phone numbers, so the same customer is not added twice
const existing = await Customer.find({}, "email phone").lean();
const existingEmails = new Set(existing.map((item) => item.email).filter(Boolean));
const existingPhones = new Set(existing.map((item) => item.phone).filter(Boolean));

const table = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^﻿/, ""));
if (table.length < 2) {
  console.log("The CSV file has no customer rows. The first row must be the header.");
  await mongoose.disconnect();
  process.exit(1);
}

const headers = table[0].map((header) => header.trim().toLowerCase());
const valid = [];
const errors = [];
const fileEmails = new Set();
const filePhones = new Set();

table.slice(1).forEach((cells, index) => {
  const row = index + 1;
  const data = {};
  headers.forEach((header, column) => {
    data[header] = (cells[column] ?? "").trim();
  });

  const problems = [];
  const name = data.name || "";
  const email = (data.email || "").toLowerCase();
  const phone = data.phone || "";

  if (!name) problems.push("name is empty");
  if (name.length > 100) problems.push("name is longer than 100 characters");
  if (phone.length > 20) problems.push("phone is longer than 20 characters");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) problems.push("email is not valid");
  if (email && (existingEmails.has(email) || fileEmails.has(email))) problems.push(`email ${email} already exists`);
  if (phone && (existingPhones.has(phone) || filePhones.has(phone))) problems.push(`phone ${phone} already exists`);
  if ((data.address || "").length > 300) problems.push("address is longer than 300 characters");
  if ((data.notes || "").length > 500) problems.push("notes are longer than 500 characters");

  if (problems.length > 0) {
    errors.push({ row, name: name || "(no name)", problems });
    return;
  }

  if (email) fileEmails.add(email);
  if (phone) filePhones.add(phone);
  valid.push({ name, phone, email, address: data.address || "", notes: data.notes || "" });
});

console.log(`\nTotal rows: ${table.length - 1}`);
console.log(`Valid: ${valid.length}`);
console.log(`Invalid: ${errors.length}`);

if (errors.length > 0) {
  console.log("\nInvalid rows (these will not be imported):");
  for (const item of errors.slice(0, SHOW_ROWS)) {
    console.log(`  Row ${item.row} (${item.name}): ${item.problems.join("; ")}`);
  }
  if (errors.length > SHOW_ROWS) console.log(`  ... and ${errors.length - SHOW_ROWS} more invalid rows`);
}

if (valid.length > 0) {
  console.log("\nImport preview:");
  for (const item of valid.slice(0, SHOW_ROWS)) {
    console.log(`  ${item.name} | ${item.phone || "-"} | ${item.email || "-"} | ${item.address || "-"}`);
  }
  if (valid.length > SHOW_ROWS) console.log(`  ... and ${valid.length - SHOW_ROWS} more`);
}

if (!apply) {
  console.log("\nThis is only a preview. Nothing was saved. To import for real, add --apply at the end of the command.");
  await mongoose.disconnect();
  process.exit(0);
}

let imported = 0;
if (valid.length > 0) {
  try {
    // An empty email is stored as "no email" by the model, so it does not break the unique email rule
    const created = await Customer.insertMany(valid, { ordered: false });
    imported = created.length;
  } catch (error) {
    imported = error.insertedDocs?.length ?? error.result?.insertedCount ?? 0;
    console.log(`\nSome customers were not saved: ${error.message}`);
  }
}

if (imported > 0) {
  await logAudit({
    userId: admin._id,
    action: "CREATE",
    entityType: "Customer",
    entityId: "csv-import",
    summary: `Imported ${imported} customers from CSV file ${csvPath.split(/[\\/]/).pop()}`,
  });
}

console.log(`\nImported: ${imported}`);
await mongoose.disconnect();
