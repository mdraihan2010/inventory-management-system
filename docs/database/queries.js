// StockPilot (Inventory Management System) - Step 2: database queries
//
// 35 queries in six groups: Create, Read, Update, Delete, Aggregation and Index.
// The same queries, with explanations and expected results, are in database-queries.pdf.
//
// How to run (MongoDB Compass):
//   1. Run seed-practice.js first (it creates the practice database).
//   2. In the mongosh panel type:   use stockpilot_practice
//   3. Copy ONE block at a time (from its title down to the next title), paste it and press Enter.
//   4. Run the blocks in order. The expected results in the PDF assume this order.
//      To start again from the beginning, run seed-practice.js again.
//
// IMPORTANT: Create, Update and Delete queries change data. Run them only in
// stockpilot_practice, never in the real database (inventory_management_system).


// ==========================================================================================
// C. CREATE QUERIES (INSERT)
// ==========================================================================================

// [C1] Insert one category
// insertOne adds a single document. The result shows the _id that MongoDB generated (it will
// be different on every run).
db.categories.insertOne({
  name: "Headphone",
  description: "Wired and wireless headphones",
  isActive: true
})

// [C2] Insert several products at once
// A product stores the _id of its category and brand (a reference). So first the category and
// the brand are found by name, and then insertMany adds two products in one call.
var headphone = db.categories.findOne({ name: "Headphone" });
var jbl = db.brands.findOne({ name: "JBL" });

db.products.insertMany([
  { name: "JBL Tune 520BT", sku: "JBL-T520-001",
    category: headphone._id, brand: jbl._id,
    purchasePrice: 4200, sellingPrice: 5200, currentStock: 8, minStockLevel: 3,
    unit: "pcs", isActive: true },
  { name: "JBL Tune 110", sku: "JBL-T110-001",
    category: headphone._id, brand: jbl._id,
    purchasePrice: 700, sellingPrice: 950, currentStock: 25, minStockLevel: 10,
    unit: "pcs", isActive: true }
])

// [C3] Try to insert a duplicate SKU (must fail)
// The sku field has a unique index. This insert uses a SKU that already exists, so MongoDB
// rejects it with error E11000. This test proves that two products can never share one SKU.
db.products.insertOne({
  name: "Fake Galaxy",
  sku: "SAM-S24-001",
  sellingPrice: 1000
})


// ==========================================================================================
// R. READ QUERIES (FIND)
// ==========================================================================================

// [R1] List all active products
// Filter: isActive is true. Projection: show only four fields and hide _id. The result is
// sorted by name (1 means ascending).
db.products.find(
  { isActive: true },
  { _id: 0, name: 1, sku: 1, sellingPrice: 1, currentStock: 1 }
).sort({ name: 1 })

// [R2] Find one product by its SKU
// findOne returns a single document (or null when nothing matches). Because SKU is unique,
// this is the fastest way to open one product.
db.products.findOne({ sku: "JBL-GO3-001" })

// [R3] Products in a price range
// $gte means greater than or equal, $lte means less than or equal. The result is sorted from
// the highest price to the lowest (-1 means descending).
db.products.find(
  { sellingPrice: { $gte: 10000, $lte: 80000 } },
  { _id: 0, name: 1, sellingPrice: 1 }
).sort({ sellingPrice: -1 })

// [R4] Search products by name or SKU
// $regex matches a part of the text and option i ignores upper and lower case. $or means that
// a match in the name or in the SKU is enough. The search box of the Products page works in
// the same way.
db.products.find(
  { $or: [
      { name: { $regex: "galaxy", $options: "i" } },
      { sku:  { $regex: "galaxy", $options: "i" } }
  ] },
  { _id: 0, name: 1, sku: 1 }
)

// [R5] Low stock and out of stock products
// Here two fields of the same document are compared, so $expr is needed. A product is listed
// when its currentStock is less than or equal to its minStockLevel.
db.products.find(
  { isActive: true, $expr: { $lte: ["$currentStock", "$minStockLevel"] } },
  { _id: 0, name: 1, currentStock: 1, minStockLevel: 1 }
)

// [R6] Products of selected categories
// $in matches any value of a list. This query shows every product that is a Smartphone or a
// Laptop.
var ids = db.categories.find({ name: { $in: ["Smartphone", "Laptop"] } })
  .toArray().map(function (c) { return c._id; });

db.products.find({ category: { $in: ids } }, { _id: 0, name: 1, sku: 1 })

// [R7] Count the completed sales
// countDocuments returns only a number. There are 6 sales in total, but one is a draft and one
// is cancelled.
db.sales.countDocuments({ status: "COMPLETED" })

// [R8] All sales of one customer
// The customer is found by name first. Then the sales that hold this customer's _id are
// listed, newest first.
var rahim = db.customers.findOne({ name: "Rahim Traders" });

db.sales.find(
  { customer: rahim._id },
  { _id: 0, saleNumber: 1, grandTotal: 1, status: 1, paymentStatus: 1 }
).sort({ saleDate: -1 })

// [R9] Completed sales that still have a due amount
// $gt means greater than. Draft and cancelled sales are left out, because only a completed
// sale creates a real due.
db.sales.find(
  { status: "COMPLETED", outstandingAmount: { $gt: 0 } },
  { _id: 0, saleNumber: 1, grandTotal: 1, paidAmount: 1, outstandingAmount: 1 }
)

// [R10] Sales in a date range
// Dates are compared with $gte (from) and $lt (before). This query shows the completed sales
// from 1 November to 5 November 2026.
db.sales.find(
  { status: "COMPLETED",
    saleDate: { $gte: ISODate("2026-11-01T00:00:00Z"),
                $lt:  ISODate("2026-11-06T00:00:00Z") } },
  { _id: 0, saleNumber: 1, saleDate: 1, grandTotal: 1 }
)

// [R11] Search inside the items of a sale
// The products of a sale are stored inside the sale document, in the items array. $elemMatch
// finds the sales where one single line is JBL Go 3 with a quantity of 2 or more.
db.sales.find(
  { items: { $elemMatch: { sku: "JBL-GO3-001", quantity: { $gte: 2 } } } },
  { _id: 0, saleNumber: 1, status: 1, "items.productName": 1, "items.quantity": 1 }
)

// [R12] Pagination (page 2, three products per page)
// skip jumps over the first rows and limit sets the page size. For page number p the rule is
// skip = (p - 1) x limit. The Products page of the website uses the same rule with 25 products
// per page.
db.products.find({}, { _id: 0, name: 1 })
  .sort({ name: 1 })
  .skip(3)
  .limit(3)


// ==========================================================================================
// U. UPDATE QUERIES
// ==========================================================================================

// [U1] Change the price of a product
// $set changes only the named field. All other fields of the product stay the same.
db.products.updateOne(
  { sku: "JBL-GO3-001" },
  { $set: { sellingPrice: 4200 } }
)

// [U2] Add stock when products arrive
// $inc adds a number to the current value inside the database. It is safer than reading the
// stock, adding in the program and writing it back, because two users can work at the same
// time. The second statement shows the new stock (4 + 10).
db.products.updateOne(
  { sku: "JBL-FLP6-001" },
  { $inc: { currentStock: 10 } }
);

db.products.findOne({ sku: "JBL-FLP6-001" }, { _id: 0, name: 1, currentStock: 1 })

// [U3] Sell more than the stock (must fail)
// Galaxy S24 has only 3 in stock. The filter says: update only if currentStock is 5 or more.
// No document matches, so nothing changes (matchedCount is 0) and the stock can never go below
// zero. The real project completes a sale with this same technique.
db.products.updateOne(
  { sku: "SAM-S24-001", currentStock: { $gte: 5 } },
  { $inc: { currentStock: -5 } }
)

// [U4] Sell an available quantity (must succeed)
// The same query with quantity 2. Now the filter matches, so the stock goes down from 3 to 1.
// The check and the change happen in one step.
db.products.updateOne(
  { sku: "SAM-S24-001", currentStock: { $gte: 2 } },
  { $inc: { currentStock: -2 } }
);

db.products.findOne({ sku: "SAM-S24-001" }, { _id: 0, name: 1, currentStock: 1 })

// [U5] Update many documents at once
// updateMany changes every document that matches. Here the minimum stock level of all Logitech
// products is set to 15.
var logitech = db.brands.findOne({ name: "Logitech" });

db.products.updateMany(
  { brand: logitech._id },
  { $set: { minStockLevel: 15 } }
)

// [U6] Record a customer payment
// Karim Electronics pays 30,000 for sale SAL-000003 (due 82,500). One document is added to
// payments, and the sale is updated: paid goes up, due goes down, and the status changes. In
// the real project these two steps run inside one transaction, so both succeed or both fail.
var sale = db.sales.findOne({ saleNumber: "SAL-000003" });

db.payments.insertOne({
  sale: sale._id, customer: sale.customer,
  amount: 30000, method: "CASH", reference: ""
});

db.sales.updateOne(
  { _id: sale._id, outstandingAmount: { $gte: 30000 } },
  { $inc: { paidAmount: 30000, outstandingAmount: -30000 },
    $set: { paymentStatus: "PARTIALLY_PAID" } }
);

db.sales.findOne(
  { saleNumber: "SAL-000003" },
  { _id: 0, saleNumber: 1, paidAmount: 1, outstandingAmount: 1, paymentStatus: 1 }
)


// ==========================================================================================
// D. DELETE QUERIES
// ==========================================================================================

// [D1] Soft delete (what the application does)
// The product is not removed. It is only marked as inactive, so it disappears from the sale
// form but old records stay correct.
db.products.updateOne(
  { sku: "JBL-T110-001" },
  { $set: { isActive: false } }
)

// [D2] Delete one document
// deleteOne removes the first document that matches the filter.
db.products.deleteOne({ sku: "JBL-T110-001" })

// [D3] Delete many documents
// deleteMany removes every match. Here all inactive products with zero stock are removed (only
// Old Test Mouse matches). Always run the same filter with find first, to see what will be
// deleted.
db.products.deleteMany({ isActive: false, currentStock: 0 })


// ==========================================================================================
// A. AGGREGATION QUERIES (REPORTS)
// ==========================================================================================

// [A1] Number of products and total stock per category
// $lookup joins each product with its category (like a JOIN in SQL). $unwind turns the joined
// array into one object. $group then counts the products and adds the stock for each category
// name.
db.products.aggregate([
  { $match: { isActive: true } },
  { $lookup: { from: "categories", localField: "category",
               foreignField: "_id", as: "category" } },
  { $unwind: "$category" },
  { $group: { _id: "$category.name",
              products: { $sum: 1 },
              totalStock: { $sum: "$currentStock" } } },
  { $sort: { _id: 1 } }
])

// [A2] Total value of the stock
// For every active product, stock is multiplied by purchase price, and all results are added.
// _id: null means one single group for the whole collection.
db.products.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: null,
              totalUnits: { $sum: "$currentStock" },
              stockValue: { $sum: {
                $multiply: ["$currentStock", "$purchasePrice"] } } } },
  { $project: { _id: 0 } }
])

// [A3] Sales summary
// Only completed sales are counted. This is the same calculation as the sales report of the
// website: number of sales, total sold, total received and total due.
db.sales.aggregate([
  { $match: { status: "COMPLETED" } },
  { $group: { _id: null,
              count: { $sum: 1 },
              totalSales: { $sum: "$grandTotal" },
              totalPaid: { $sum: "$paidAmount" },
              totalOutstanding: { $sum: "$outstandingAmount" } } },
  { $project: { _id: 0 } }
])

// [A4] Due amount per customer
// The unpaid completed sales are grouped by customer, and the customer name is added with
// $lookup. The customer with the highest due comes first.
db.sales.aggregate([
  { $match: { status: "COMPLETED", outstandingAmount: { $gt: 0 } } },
  { $group: { _id: "$customer",
              sales: { $sum: 1 },
              totalDue: { $sum: "$outstandingAmount" } } },
  { $lookup: { from: "customers", localField: "_id",
               foreignField: "_id", as: "customer" } },
  { $unwind: "$customer" },
  { $project: { _id: 0, customer: "$customer.name", sales: 1, totalDue: 1 } },
  { $sort: { totalDue: -1 } }
])

// [A5] Best selling products
// $unwind makes one document for every line of the items array. Then the lines are grouped by
// product, and the quantity and the amount are added.
db.sales.aggregate([
  { $match: { status: "COMPLETED" } },
  { $unwind: "$items" },
  { $group: { _id: "$items.productName",
              quantitySold: { $sum: "$items.quantity" },
              revenue: { $sum: "$items.lineTotal" } } },
  { $sort: { quantitySold: -1, revenue: -1 } },
  { $limit: 3 }
])

// [A6] Gross profit
// Every sale line stores costPrice, the purchase price on the day of the sale. Profit of a
// line = (unit price - cost price) x quantity. Discounts are not subtracted here.
db.sales.aggregate([
  { $match: { status: "COMPLETED" } },
  { $unwind: "$items" },
  { $group: { _id: null,
              revenue: { $sum: "$items.lineTotal" },
              cost: { $sum: {
                $multiply: ["$items.costPrice", "$items.quantity"] } } } },
  { $project: { _id: 0, revenue: 1, cost: 1,
                grossProfit: { $subtract: ["$revenue", "$cost"] } } }
])

// [A7] Sales per day (Bangladesh time)
// MongoDB stores dates in UTC. $dateToString with the timezone Asia/Dhaka changes each date to
// the local day first. Sale SAL-000004 was saved at 19:30 UTC on 7 November, so it is
// correctly counted on 8 November.
db.sales.aggregate([
  { $match: { status: "COMPLETED" } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate",
                                      timezone: "Asia/Dhaka" } },
              sales: { $sum: 1 },
              total: { $sum: "$grandTotal" } } },
  { $sort: { _id: 1 } }
])

// [A8] Money owed to each supplier
// For a purchase: outstanding = grand total - returned amount - paid amount. $subtract
// calculates this for every completed purchase, and then it is added per supplier. Suppliers
// that are fully paid are left out.
db.purchases.aggregate([
  { $match: { status: "COMPLETED" } },
  { $group: { _id: "$supplier",
              purchases: { $sum: 1 },
              owed: { $sum: { $subtract: [
                { $subtract: ["$grandTotal", "$returnedAmount"] },
                "$paidAmount" ] } } } },
  { $match: { owed: { $gt: 0 } } },
  { $lookup: { from: "suppliers", localField: "_id",
               foreignField: "_id", as: "supplier" } },
  { $unwind: "$supplier" },
  { $project: { _id: 0, supplier: "$supplier.name", purchases: 1, owed: 1 } },
  { $sort: { owed: -1 } }
])

// [A9] Money received by payment method
// The payments collection is grouped by method. The cash total includes the payment of 30,000
// from query U6.
db.payments.aggregate([
  { $group: { _id: "$method",
              payments: { $sum: 1 },
              total: { $sum: "$amount" } } },
  { $sort: { total: -1 } }
])


// ==========================================================================================
// I. INDEX QUERIES
// ==========================================================================================

// [I1] Show the indexes of a collection
// Every collection has an index on _id. The products collection also has the unique index on
// sku that made query C3 fail.
db.products.getIndexes()

// [I2] Check that a query uses the index
// explain shows how MongoDB runs a query. With the SKU index, MongoDB reads only one document
// to find one product (totalDocsExamined: 1), even if the collection has 10,000 products. The
// winning plan shows the stage IXSCAN (in MongoDB 8 it can be EXPRESS_IXSCAN). Without an
// index the stage would be COLLSCAN, which reads every document.
var stats = db.products.find({ sku: "JBL-GO3-001" })
  .explain("executionStats").executionStats;

({ nReturned: stats.nReturned,
   totalKeysExamined: stats.totalKeysExamined,
   totalDocsExamined: stats.totalDocsExamined })
