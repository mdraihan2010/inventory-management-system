import "dotenv/config";
import fs from "fs";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import StockMovement from "../models/StockMovement.js";
import User from "../models/User.js";
import { logAudit } from "../utils/auditLogger.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
// With --create-brands, brands that do not exist yet are created during the import
const createBrands = args.includes("--create-brands");
const [csvPath, adminEmailArg] = args.filter((arg) => !arg.startsWith("--"));

// Products are saved in groups. Each group is saved in one transaction, so a group is saved fully or not at all
const BATCH_SIZE = 500;
// How many rows the preview and the error list show
const SHOW_ROWS = 20;

if (!csvPath || !adminEmailArg) {
  console.log(
    'Usage: node src/scripts/importProducts.js "<csv file path>" "<admin email>" [--create-brands] [--apply]'
  );
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

function toNumber(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

await mongoose.connect(process.env.MONGO_URI);

const admin = await User.findOne({ email: adminEmailArg.toLowerCase().trim(), isActive: true });
if (!admin || !["ADMINISTRATOR", "MANAGER"].includes(admin.role)) {
  console.log("No active Administrator or Manager was found with this email.");
  await mongoose.disconnect();
  process.exit(1);
}

const categories = await Category.find({}).lean();
const brands = await Brand.find({}).lean();
const categoryByName = new Map(categories.map((item) => [item.name.toLowerCase(), item]));
const brandByName = new Map(brands.map((item) => [item.name.toLowerCase(), item]));

const existingSkus = new Set((await Product.find({}, "sku").lean()).map((item) => item.sku));
const existingBarcodes = new Set(
  (await Product.find({ barcode: { $type: "string" } }, "barcode").lean()).map((item) => item.barcode)
);

const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const table = parseCsv(text);

if (table.length < 2) {
  console.log("The CSV file has no product rows. The first row must be the header, followed by the products.");
  await mongoose.disconnect();
  process.exit(1);
}

const headers = table[0].map((header) => header.trim().toLowerCase());
const records = table.slice(1).map((cells, index) => {
  const data = {};
  headers.forEach((header, column) => {
    data[header] = (cells[column] ?? "").trim();
  });
  return { row: index + 1, data };
});

const valid = [];
const errors = [];
// Brands that will be created because of --create-brands (lowercase name -> brand)
const newBrands = new Map();
const fileSkus = new Set();
const fileBarcodes = new Set();

for (const { row, data } of records) {
  const problems = [];
  const name = data.name || "";
  const sku = (data.sku || "").toUpperCase();
  const barcode = data.barcode || null;

  if (!name) problems.push("name is empty");
  if (name.length > 150) problems.push("name is longer than 150 characters");

  if (!sku) {
    problems.push("sku is empty");
  } else if (existingSkus.has(sku)) {
    problems.push(`SKU ${sku} already exists`);
  } else if (fileSkus.has(sku)) {
    problems.push(`SKU ${sku} appears twice in the CSV`);
  }

  const category = categoryByName.get((data.category || "").toLowerCase());
  if (!data.category) {
    problems.push("category is empty");
  } else if (!category) {
    problems.push(`category "${data.category}" was not found`);
  } else if (!category.isActive) {
    problems.push(`category "${data.category}" is inactive`);
  }

  let brand = brandByName.get((data.brand || "").toLowerCase());
  if (!brand && data.brand && createBrands) {
    const key = data.brand.toLowerCase();
    if (!newBrands.has(key)) newBrands.set(key, { _id: null, name: data.brand, isActive: true });
    brand = newBrands.get(key);
  }
  if (!data.brand) {
    problems.push("brand is empty");
  } else if (!brand) {
    problems.push(`brand "${data.brand}" was not found (add --create-brands to create it)`);
  } else if (!brand.isActive) {
    problems.push(`brand "${data.brand}" is inactive`);
  }

  const sellingPrice = toNumber(data.selling_price, NaN);
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    problems.push("selling_price is not a valid number");
  }

  const purchasePrice = toNumber(data.purchase_price, 0);
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    problems.push("purchase_price is not a valid number");
  }

  const minStockLevel = toNumber(data.min_stock_level, 0);
  if (!Number.isInteger(minStockLevel) || minStockLevel < 0) {
    problems.push("min_stock_level must be a whole number");
  }

  const openingStock = toNumber(data.opening_stock, 0);
  if (!Number.isInteger(openingStock) || openingStock < 0) {
    problems.push("opening_stock must be a whole number");
  }

  if (barcode) {
    if (existingBarcodes.has(barcode) || fileBarcodes.has(barcode)) {
      problems.push(`barcode ${barcode} already exists`);
    }
  }

  if (problems.length > 0) {
    errors.push({ row, name: name || "(no name)", problems });
    continue;
  }

  fileSkus.add(sku);
  if (barcode) fileBarcodes.add(barcode);

  valid.push({
    row,
    name,
    sku,
    barcode,
    description: data.description || "",
    category,
    brand,
    purchasePrice,
    sellingPrice,
    minStockLevel,
    openingStock,
    unit: data.unit || "pcs",
  });
}

console.log(`\nTotal rows: ${records.length}`);
console.log(`Valid: ${valid.length}`);
console.log(`Invalid: ${errors.length}`);

if (errors.length > 0) {
  console.log("\nInvalid rows (these will not be imported):");
  for (const item of errors.slice(0, SHOW_ROWS)) {
    console.log(`  Row ${item.row} (${item.name}): ${item.problems.join("; ")}`);
  }
  if (errors.length > SHOW_ROWS) console.log(`  ... and ${errors.length - SHOW_ROWS} more invalid rows`);
}

if (newBrands.size > 0) {
  console.log(`\nNew brands that will be created: ${[...newBrands.values()].map((b) => b.name).join(", ")}`);
}

if (valid.length > 0) {
  const perCategory = new Map();
  for (const item of valid) perCategory.set(item.category.name, (perCategory.get(item.category.name) || 0) + 1);
  console.log("\nValid products per category:");
  for (const [name, count] of [...perCategory].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  console.log("\nImport preview:");
  for (const item of valid.slice(0, SHOW_ROWS)) {
    console.log(
      `  ${item.name} | ${item.sku} | ${item.category.name} | ${item.brand.name} | Selling ${item.sellingPrice} | Opening stock ${item.openingStock}`
    );
  }
  if (valid.length > SHOW_ROWS) console.log(`  ... and ${valid.length - SHOW_ROWS} more`);
}

if (!apply) {
  console.log("\nThis is only a preview. Nothing was saved. To import for real, add --apply at the end of the command.");
  await mongoose.disconnect();
  process.exit(0);
}

// Create the new brands first, so the products can refer to them
for (const brand of newBrands.values()) {
  const created = await Brand.create({ name: brand.name });
  brand._id = created._id;
  await logAudit({
    userId: admin._id,
    action: "CREATE",
    entityType: "Brand",
    entityId: created._id,
    summary: `Created brand ${created.name} during CSV import`,
  });
}

let imported = 0;
const failed = [];
const startedAt = Date.now();

for (let start = 0; start < valid.length; start += BATCH_SIZE) {
  const batch = valid.slice(start, start + BATCH_SIZE);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // The opening stock is set directly, and one OPENING_STOCK record is written for each product that has stock
      const products = await Product.insertMany(
        batch.map((item) => ({
          name: item.name,
          sku: item.sku,
          barcode: item.barcode,
          description: item.description,
          category: item.category._id,
          brand: item.brand._id,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          minStockLevel: item.minStockLevel,
          unit: item.unit,
          currentStock: item.openingStock,
        })),
        { session, ordered: true }
      );

      const movements = products
        .map((product, index) => ({ product, openingStock: batch[index].openingStock }))
        .filter(({ openingStock }) => openingStock > 0)
        .map(({ product, openingStock }) => ({
          product: product._id,
          type: "OPENING_STOCK",
          change: openingStock,
          previousStock: 0,
          resultingStock: openingStock,
          reason: "Opening stock (CSV import)",
          createdBy: admin._id,
        }));

      if (movements.length > 0) {
        await StockMovement.insertMany(movements, { session, ordered: true });
      }
    });

    imported += batch.length;
    console.log(`  Saved ${imported} of ${valid.length}`);
  } catch (error) {
    failed.push({ from: batch[0].row, to: batch[batch.length - 1].row, message: error.message });
    console.log(`  Rows ${batch[0].row} to ${batch[batch.length - 1].row} were not saved: ${error.message}`);
  } finally {
    await session.endSession();
  }
}

// One audit entry for the whole import, so the audit log is not filled with thousands of rows
if (imported > 0) {
  await logAudit({
    userId: admin._id,
    action: "CREATE",
    entityType: "Product",
    entityId: "csv-import",
    summary: `Imported ${imported} products from CSV file ${csvPath.split(/[\\/]/).pop()}`,
  });
}

const seconds = Math.round((Date.now() - startedAt) / 1000);
console.log(`\nImported: ${imported} (in ${seconds} seconds)`);

if (failed.length > 0) {
  console.log("\nFailed to import (run the same command again to retry; saved rows are skipped as existing SKUs):");
  for (const item of failed) {
    console.log(`  Rows ${item.from} to ${item.to}: ${item.message}`);
  }
}

await mongoose.disconnect();
