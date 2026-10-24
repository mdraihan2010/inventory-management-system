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
const [csvPath, adminEmailArg] = args.filter((arg) => !arg.startsWith("--"));

if (!csvPath || !adminEmailArg) {
  console.log('ব্যবহার: node src/scripts/importProducts.js "<csv ফাইলের পথ>" "<admin email>" [--apply]');
  process.exit(1);
}

// CSV পড়ার সাধারণ ফাংশন। ডাবল কোটেশনের ভেতরের কমা ঠিকভাবে ধরে
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
  console.log("এই email দিয়ে সক্রিয় Administrator বা Manager পাওয়া যায়নি।");
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
  console.log("CSV ফাইলে কোনো পণ্যের সারি নেই। প্রথম সারি শিরোনাম, তারপর পণ্য।");
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
const fileSkus = new Set();
const fileBarcodes = new Set();

for (const { row, data } of records) {
  const problems = [];
  const name = data.name || "";
  const sku = (data.sku || "").toUpperCase();
  const barcode = data.barcode || null;

  if (!name) problems.push("name খালি");
  if (name.length > 150) problems.push("name ১৫০ অক্ষরের বেশি");

  if (!sku) {
    problems.push("sku খালি");
  } else if (existingSkus.has(sku)) {
    problems.push(`SKU ${sku} আগে থেকেই আছে`);
  } else if (fileSkus.has(sku)) {
    problems.push(`SKU ${sku} CSV-তে দুবার আছে`);
  }

  const category = categoryByName.get((data.category || "").toLowerCase());
  if (!data.category) {
    problems.push("category খালি");
  } else if (!category) {
    problems.push(`category "${data.category}" পাওয়া যায়নি`);
  } else if (!category.isActive) {
    problems.push(`category "${data.category}" বন্ধ আছে`);
  }

  const brand = brandByName.get((data.brand || "").toLowerCase());
  if (!data.brand) {
    problems.push("brand খালি");
  } else if (!brand) {
    problems.push(`brand "${data.brand}" পাওয়া যায়নি`);
  } else if (!brand.isActive) {
    problems.push(`brand "${data.brand}" বন্ধ আছে`);
  }

  const sellingPrice = toNumber(data.selling_price, NaN);
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    problems.push("selling_price সঠিক সংখ্যা নয়");
  }

  const purchasePrice = toNumber(data.purchase_price, 0);
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    problems.push("purchase_price সঠিক সংখ্যা নয়");
  }

  const minStockLevel = toNumber(data.min_stock_level, 0);
  if (!Number.isInteger(minStockLevel) || minStockLevel < 0) {
    problems.push("min_stock_level পূর্ণ সংখ্যা হতে হবে");
  }

  const openingStock = toNumber(data.opening_stock, 0);
  if (!Number.isInteger(openingStock) || openingStock < 0) {
    problems.push("opening_stock পূর্ণ সংখ্যা হতে হবে");
  }

  if (barcode) {
    if (existingBarcodes.has(barcode) || fileBarcodes.has(barcode)) {
      problems.push(`barcode ${barcode} আগে থেকেই আছে`);
    }
  }

  if (problems.length > 0) {
    errors.push({ row, name: name || "(নাম নেই)", problems });
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

console.log(`\nমোট সারি: ${records.length}`);
console.log(`ঠিক আছে: ${valid.length}`);
console.log(`ভুল: ${errors.length}`);

if (errors.length > 0) {
  console.log("\nভুল সারিগুলো (এগুলো আমদানি হবে না):");
  for (const item of errors) {
    console.log(`  সারি ${item.row} (${item.name}): ${item.problems.join("; ")}`);
  }
}

if (valid.length > 0) {
  console.log("\nআমদানির পূর্বরূপ:");
  for (const item of valid) {
    console.log(
      `  ${item.name} | ${item.sku} | ${item.category.name} | ${item.brand.name} | বিক্রয় ${item.sellingPrice} | শুরুর স্টক ${item.openingStock}`
    );
  }
}

if (!apply) {
  console.log("\nএটি শুধু পূর্বরূপ, কিছু লেখা হয়নি। সত্যিকার আমদানি করতে কমান্ডের শেষে --apply যোগ করুন।");
  await mongoose.disconnect();
  process.exit(0);
}

let imported = 0;
const failed = [];

for (const item of valid) {
  const session = await mongoose.startSession();
  let created = null;

  try {
    await session.withTransaction(async () => {
      const [product] = await Product.create(
        [
          {
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
          },
        ],
        { session }
      );

      if (item.openingStock > 0) {
        const updated = await Product.findByIdAndUpdate(
          product._id,
          { $inc: { currentStock: item.openingStock } },
          { new: true, session }
        );

        await StockMovement.create(
          [
            {
              product: product._id,
              type: "OPENING_STOCK",
              change: item.openingStock,
              previousStock: 0,
              resultingStock: updated.currentStock,
              reason: "Opening stock (CSV import)",
              createdBy: admin._id,
            },
          ],
          { session }
        );
      }

      created = product;
    });

    await logAudit({
      userId: admin._id,
      action: "CREATE",
      entityType: "Product",
      entityId: created._id,
      summary: `Imported product ${item.name} (SKU ${item.sku}) from CSV`,
    });

    imported++;
  } catch (error) {
    failed.push({ row: item.row, name: item.name, message: error.message });
  } finally {
    await session.endSession();
  }
}

console.log(`\nআমদানি হয়েছে: ${imported} টি`);

if (failed.length > 0) {
  console.log("\nআমদানি ব্যর্থ হয়েছে:");
  for (const item of failed) {
    console.log(`  সারি ${item.row} (${item.name}): ${item.message}`);
  }
}

await mongoose.disconnect();
