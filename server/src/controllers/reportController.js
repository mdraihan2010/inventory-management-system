import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// from ও to থেকে তারিখের সীমা বের করে। কিছু না দিলে সব সময়
function dateRange(query) {
  const range = {};

  if (query.from) {
    const from = new Date(`${query.from}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime())) {
      throw Object.assign(new Error("Invalid from date. Use YYYY-MM-DD"), { status: 400 });
    }
    range.$gte = from;
  }

  if (query.to) {
    const to = new Date(`${query.to}T23:59:59.999Z`);
    if (Number.isNaN(to.getTime())) {
      throw Object.assign(new Error("Invalid to date. Use YYYY-MM-DD"), { status: 400 });
    }
    range.$lte = to;
  }

  return Object.keys(range).length ? range : null;
}

// GET /api/v1/reports/sales
export async function salesReport(req, res) {
  try {
    const range = dateRange(req.query);
    const match = { status: "COMPLETED" };
    if (range) match.saleDate = range;

    const [summary] = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSales: { $sum: "$grandTotal" },
          totalPaid: { $sum: "$paidAmount" },
          totalOutstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        count: summary ? summary.count : 0,
        totalSales: roundMoney(summary ? summary.totalSales : 0),
        totalPaid: roundMoney(summary ? summary.totalPaid : 0),
        totalOutstanding: roundMoney(summary ? summary.totalOutstanding : 0),
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Sales report error:", error.message);
    res.status(500).json({ success: false, message: "Server error while building sales report" });
  }
}

// GET /api/v1/reports/purchases
export async function purchasesReport(req, res) {
  try {
    const range = dateRange(req.query);
    const match = { status: "COMPLETED" };
    if (range) match.purchaseDate = range;

    const [summary] = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalPurchases: { $sum: "$grandTotal" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        count: summary ? summary.count : 0,
        totalPurchases: roundMoney(summary ? summary.totalPurchases : 0),
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Purchases report error:", error.message);
    res.status(500).json({ success: false, message: "Server error while building purchases report" });
  }
}

// GET /api/v1/reports/stock-value
export async function stockValueReport(req, res) {
  try {
    const products = await Product.find({ isActive: true })
      .select("name sku currentStock purchasePrice")
      .sort({ name: 1 });

    let totalValue = 0;
    const items = products.map((product) => {
      const value = roundMoney(product.currentStock * product.purchasePrice);
      totalValue += value;
      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        purchasePrice: product.purchasePrice,
        stockValue: value,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalValue: roundMoney(totalValue),
        items,
      },
    });
  } catch (error) {
    console.error("Stock value report error:", error.message);
    res.status(500).json({ success: false, message: "Server error while building stock value report" });
  }
}

// GET /api/v1/reports/profit
// লাভ শুধু ক্রয়মূল্যসহ বিক্রির লাইন থেকে হিসাব হয়
export async function profitReport(req, res) {
  try {
    const range = dateRange(req.query);
    const match = { status: "COMPLETED" };
    if (range) match.saleDate = range;

    // এই লাইনে costPrice একটি সংখ্যা হিসেবে আছে কিনা। পুরোনো লাইনে field-ই নেই, তাই এটা false
    const hasCost = { $in: [{ $type: "$items.costPrice" }, ["double", "int", "long", "decimal"]] };

    const [summary] = await Sale.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          revenueWithCost: { $sum: { $cond: [hasCost, "$items.lineTotal", 0] } },
          cost: {
            $sum: {
              $cond: [hasCost, { $multiply: ["$items.costPrice", "$items.quantity"] }, 0],
            },
          },
          linesWithCostPrice: { $sum: { $cond: [hasCost, 1, 0] } },
          linesWithoutCostPrice: { $sum: { $cond: [hasCost, 0, 1] } },
          revenueWithoutCostPrice: { $sum: { $cond: [hasCost, 0, "$items.lineTotal"] } },
        },
      },
    ]);

    const revenue = roundMoney(summary ? summary.revenueWithCost : 0);
    const cost = roundMoney(summary ? summary.cost : 0);

    res.status(200).json({
      success: true,
      data: {
        revenue,
        cost,
        grossProfit: roundMoney(revenue - cost),
        linesWithCostPrice: summary ? summary.linesWithCostPrice : 0,
        linesWithoutCostPrice: summary ? summary.linesWithoutCostPrice : 0,
        revenueWithoutCostPrice: roundMoney(summary ? summary.revenueWithoutCostPrice : 0),
        note: "Profit is calculated only on lines that have a recorded cost price. Gross profit only.",
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Profit report error:", error.message);
    res.status(500).json({ success: false, message: "Server error while building profit report" });
  }
}
