import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Return from "../models/Return.js";

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// Works out the date range from "from" and "to". If neither is given, all time is used
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

// Adds the cash refund part of customer returns to each sale
function cashRefundLookup() {
  return {
    $lookup: {
      from: "returns",
      let: { saleId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [{ $eq: ["$sale", "$$saleId"] }, { $eq: ["$kind", "CUSTOMER"] }],
            },
          },
        },
      ],
      as: "refunds",
    },
  };
}

// GET /api/v1/reports/sales
// Returns are subtracted from sales totals. Cash refunds are subtracted from payments
export async function salesReport(req, res) {
  try {
    const range = dateRange(req.query);
    const match = { status: "COMPLETED" };
    if (range) match.saleDate = range;

    const [summary] = await Sale.aggregate([
      { $match: match },
      cashRefundLookup(),
      {
        $addFields: {
          returnedAmount: { $ifNull: ["$returnedAmount", 0] },
          paidAmount: { $ifNull: ["$paidAmount", 0] },
          cashRefunded: { $sum: "$refunds.cashRefund" },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          grossSales: { $sum: "$grandTotal" },
          totalReturned: { $sum: "$returnedAmount" },
          grossPaid: { $sum: "$paidAmount" },
          totalCashRefunded: { $sum: "$cashRefunded" },
          totalOutstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    const count = summary ? summary.count : 0;
    const totalReturned = roundMoney(summary ? summary.totalReturned : 0);
    const totalCashRefunded = roundMoney(summary ? summary.totalCashRefunded : 0);

    res.status(200).json({
      success: true,
      data: {
        count,
        totalSales: roundMoney((summary ? summary.grossSales : 0) - totalReturned),
        totalPaid: roundMoney((summary ? summary.grossPaid : 0) - totalCashRefunded),
        totalOutstanding: roundMoney(summary ? summary.totalOutstanding : 0),
        totalReturned,
        totalCashRefunded,
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
// The value of products returned to suppliers is subtracted from purchases
export async function purchasesReport(req, res) {
  try {
    const range = dateRange(req.query);
    const match = { status: "COMPLETED" };
    if (range) match.purchaseDate = range;

    const [summary] = await Purchase.aggregate([
      { $match: match },
      {
        $addFields: {
          returnedAmount: { $ifNull: ["$returnedAmount", 0] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          grossPurchases: { $sum: "$grandTotal" },
          totalReturned: { $sum: "$returnedAmount" },
        },
      },
    ]);

    const totalReturned = roundMoney(summary ? summary.totalReturned : 0);

    res.status(200).json({
      success: true,
      data: {
        count: summary ? summary.count : 0,
        totalPurchases: roundMoney((summary ? summary.grossPurchases : 0) - totalReturned),
        totalReturned,
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
// Profit is calculated only from sale lines that have a purchase cost. Returned lines are removed here
export async function profitReport(req, res) {
  try {
    const range = dateRange(req.query);
    const match = { status: "COMPLETED" };
    if (range) match.saleDate = range;

    // Checks whether this line has costPrice as a number. Older lines have no such field, so this is false
    const hasCost = { $in: [{ $type: "$items.costPrice" }, ["double", "int", "long", "decimal"]] };

    const [sales] = await Sale.aggregate([
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

    // Returned lines, only from sales that fall within this period
    const returnedMatch = { "saleDoc.status": "COMPLETED" };
    if (range) returnedMatch["saleDoc.saleDate"] = range;

    const [returned] = await Return.aggregate([
      { $match: { kind: "CUSTOMER" } },
      { $lookup: { from: "sales", localField: "sale", foreignField: "_id", as: "saleDoc" } },
      { $unwind: "$saleDoc" },
      { $match: returnedMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          returnedRevenueWithCost: { $sum: { $cond: [hasCost, "$items.lineTotal", 0] } },
          returnedCost: {
            $sum: {
              $cond: [hasCost, { $multiply: ["$items.costPrice", "$items.quantity"] }, 0],
            },
          },
          returnedRevenueWithoutCost: { $sum: { $cond: [hasCost, 0, "$items.lineTotal"] } },
        },
      },
    ]);

    const revenue = roundMoney(
      (sales ? sales.revenueWithCost : 0) - (returned ? returned.returnedRevenueWithCost : 0)
    );
    const cost = roundMoney(
      (sales ? sales.cost : 0) - (returned ? returned.returnedCost : 0)
    );
    const revenueWithoutCostPrice = roundMoney(
      (sales ? sales.revenueWithoutCostPrice : 0) - (returned ? returned.returnedRevenueWithoutCost : 0)
    );

    res.status(200).json({
      success: true,
      data: {
        revenue,
        cost,
        grossProfit: roundMoney(revenue - cost),
        linesWithCostPrice: sales ? sales.linesWithCostPrice : 0,
        linesWithoutCostPrice: sales ? sales.linesWithoutCostPrice : 0,
        revenueWithoutCostPrice,
        note: "Profit is calculated only on lines that have a recorded cost price. Returns are deducted. Gross profit only.",
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
