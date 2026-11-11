// StockPilot (Inventory Management System) - sample data for PRACTICE
//
// This script fills a separate practice database with a small set of sample data.
// The collections and field names are the same as in the real project models
// (server/src/models), so every query in queries.js also works on the real database.
//
// How to run (MongoDB Compass):
//   1. Connect to the cluster and open the mongosh panel at the bottom of the window.
//   2. Type:   use stockpilot_practice
//   3. Paste this whole file and press Enter.
//
// Safety: the script stops if the current database is not stockpilot_practice,
// so it can never remove data from the real database.

if (db.getName() !== "stockpilot_practice") {
  throw new Error("Wrong database. First run:  use stockpilot_practice");
}

// Start from an empty state, so the script can be run again and again
[
  "users", "categories", "brands", "products", "customers", "suppliers",
  "sales", "payments", "purchases", "supplierpayments",
].forEach(function (name) {
  db.getCollection(name).drop();
});

// ---------- users (no passwords here: this database is only for query practice) ----------
db.users.insertMany([
  { _id: ObjectId("650000000000000000000001"), name: "Admin User", email: "admin@example.com", role: "ADMINISTRATOR", isActive: true },
  { _id: ObjectId("650000000000000000000002"), name: "Sales Staff", email: "staff@example.com", role: "SALES_STAFF", isActive: true },
]);

// ---------- categories ----------
db.categories.insertMany([
  { _id: ObjectId("650000000000000000000101"), name: "Smartphone", description: "Mobile phones", isActive: true },
  { _id: ObjectId("650000000000000000000102"), name: "Laptop", description: "Notebook computers", isActive: true },
  { _id: ObjectId("650000000000000000000103"), name: "Speaker", description: "Bluetooth speakers", isActive: true },
  { _id: ObjectId("650000000000000000000104"), name: "Mouse", description: "Computer mouse", isActive: true },
]);

// ---------- brands ----------
db.brands.insertMany([
  { _id: ObjectId("650000000000000000000201"), name: "Samsung", description: "", isActive: true },
  { _id: ObjectId("650000000000000000000202"), name: "Dell", description: "", isActive: true },
  { _id: ObjectId("650000000000000000000203"), name: "JBL", description: "", isActive: true },
  { _id: ObjectId("650000000000000000000204"), name: "Logitech", description: "", isActive: true },
]);

// ---------- products ----------
db.products.insertMany([
  { _id: ObjectId("650000000000000000000301"), name: "Galaxy S24", sku: "SAM-S24-001", category: ObjectId("650000000000000000000101"), brand: ObjectId("650000000000000000000201"), purchasePrice: 85000, sellingPrice: 95000, currentStock: 3, minStockLevel: 5, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000302"), name: "Galaxy A15", sku: "SAM-A15-001", category: ObjectId("650000000000000000000101"), brand: ObjectId("650000000000000000000201"), purchasePrice: 18000, sellingPrice: 21000, currentStock: 12, minStockLevel: 5, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000303"), name: "Dell Inspiron 15", sku: "DEL-INS15-001", category: ObjectId("650000000000000000000102"), brand: ObjectId("650000000000000000000202"), purchasePrice: 62000, sellingPrice: 70000, currentStock: 6, minStockLevel: 3, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000304"), name: "Dell Latitude 5440", sku: "DEL-LAT5440-001", category: ObjectId("650000000000000000000102"), brand: ObjectId("650000000000000000000202"), purchasePrice: 98000, sellingPrice: 110000, currentStock: 0, minStockLevel: 2, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000305"), name: "JBL Go 3", sku: "JBL-GO3-001", category: ObjectId("650000000000000000000103"), brand: ObjectId("650000000000000000000203"), purchasePrice: 3200, sellingPrice: 4000, currentStock: 15, minStockLevel: 5, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000306"), name: "JBL Flip 6", sku: "JBL-FLP6-001", category: ObjectId("650000000000000000000103"), brand: ObjectId("650000000000000000000203"), purchasePrice: 10500, sellingPrice: 12500, currentStock: 4, minStockLevel: 4, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000307"), name: "M331 Silent Mouse", sku: "LOG-M331-001", category: ObjectId("650000000000000000000104"), brand: ObjectId("650000000000000000000204"), purchasePrice: 1400, sellingPrice: 1800, currentStock: 30, minStockLevel: 10, unit: "pcs", isActive: true },
  { _id: ObjectId("650000000000000000000308"), name: "Old Test Mouse", sku: "LOG-OLD-001", category: ObjectId("650000000000000000000104"), brand: ObjectId("650000000000000000000204"), purchasePrice: 500, sellingPrice: 700, currentStock: 0, minStockLevel: 0, unit: "pcs", isActive: false },
]);

// The real project has the same rule: two products can never share one SKU
db.products.createIndex({ sku: 1 }, { unique: true });

// ---------- customers ----------
db.customers.insertMany([
  { _id: ObjectId("650000000000000000000401"), name: "Rahim Traders", phone: "01711000001", email: "rahim@example.com", address: "Jashore", isActive: true },
  { _id: ObjectId("650000000000000000000402"), name: "Karim Electronics", phone: "01711000002", email: "karim@example.com", address: "Khulna", isActive: true },
  { _id: ObjectId("650000000000000000000403"), name: "Nusrat Jahan", phone: "01711000003", address: "Dhaka", isActive: true },
]);

// ---------- suppliers ----------
db.suppliers.insertMany([
  { _id: ObjectId("650000000000000000000501"), name: "Tech Supply BD", companyName: "Tech Supply BD Ltd.", phone: "01811000001", address: "Dhaka", isActive: true },
  { _id: ObjectId("650000000000000000000502"), name: "Global Gadget Importers", companyName: "Global Gadget Importers", phone: "01811000002", address: "Chattogram", isActive: true },
]);

// ---------- purchases (products bought from suppliers) ----------
db.purchases.insertMany([
  {
    _id: ObjectId("650000000000000000000701"), purchaseNumber: "PUR-000001",
    supplier: ObjectId("650000000000000000000501"), purchaseDate: ISODate("2026-10-28T04:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000301"), productName: "Galaxy S24", sku: "SAM-S24-001", quantity: 5, unitPrice: 85000, lineTotal: 425000 },
      { product: ObjectId("650000000000000000000302"), productName: "Galaxy A15", sku: "SAM-A15-001", quantity: 20, unitPrice: 18000, lineTotal: 360000 },
    ],
    subtotal: 785000, discount: 0, grandTotal: 785000, paidAmount: 500000, returnedAmount: 0,
    status: "COMPLETED", createdBy: ObjectId("650000000000000000000001"),
  },
  {
    _id: ObjectId("650000000000000000000702"), purchaseNumber: "PUR-000002",
    supplier: ObjectId("650000000000000000000502"), purchaseDate: ISODate("2026-10-29T05:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000305"), productName: "JBL Go 3", sku: "JBL-GO3-001", quantity: 20, unitPrice: 3200, lineTotal: 64000 },
      { product: ObjectId("650000000000000000000306"), productName: "JBL Flip 6", sku: "JBL-FLP6-001", quantity: 10, unitPrice: 10500, lineTotal: 105000 },
    ],
    // One JBL Flip 6 was sent back to the supplier, so 10,500 is no longer owed
    subtotal: 169000, discount: 0, grandTotal: 169000, paidAmount: 100000, returnedAmount: 10500,
    status: "COMPLETED", createdBy: ObjectId("650000000000000000000001"),
  },
  {
    _id: ObjectId("650000000000000000000703"), purchaseNumber: "PUR-000003",
    supplier: ObjectId("650000000000000000000501"), purchaseDate: ISODate("2026-10-30T06:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000307"), productName: "M331 Silent Mouse", sku: "LOG-M331-001", quantity: 40, unitPrice: 1400, lineTotal: 56000 },
    ],
    subtotal: 56000, discount: 0, grandTotal: 56000, paidAmount: 56000, returnedAmount: 0,
    status: "COMPLETED", createdBy: ObjectId("650000000000000000000001"),
  },
  {
    _id: ObjectId("650000000000000000000704"), purchaseNumber: "PUR-000004",
    supplier: ObjectId("650000000000000000000502"), purchaseDate: ISODate("2026-11-08T05:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000304"), productName: "Dell Latitude 5440", sku: "DEL-LAT5440-001", quantity: 5, unitPrice: 98000, lineTotal: 490000 },
    ],
    subtotal: 490000, discount: 0, grandTotal: 490000, paidAmount: 0, returnedAmount: 0,
    status: "DRAFT", createdBy: ObjectId("650000000000000000000001"),
  },
]);

// ---------- supplierpayments (money paid to suppliers) ----------
db.supplierpayments.insertMany([
  { purchase: ObjectId("650000000000000000000701"), supplier: ObjectId("650000000000000000000501"), amount: 500000, method: "BANK_TRANSFER", reference: "TRX-PUR-1", createdBy: ObjectId("650000000000000000000001") },
  { purchase: ObjectId("650000000000000000000702"), supplier: ObjectId("650000000000000000000502"), amount: 100000, method: "BANK_TRANSFER", reference: "TRX-PUR-2", createdBy: ObjectId("650000000000000000000001") },
  { purchase: ObjectId("650000000000000000000703"), supplier: ObjectId("650000000000000000000501"), amount: 56000, method: "CASH", reference: "", createdBy: ObjectId("650000000000000000000001") },
]);

// ---------- sales ----------
// costPrice is the purchase price at the time of the sale. It is used to calculate profit.
db.sales.insertMany([
  {
    _id: ObjectId("650000000000000000000601"), saleNumber: "SAL-000001",
    customer: ObjectId("650000000000000000000401"), saleDate: ISODate("2026-11-02T05:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000301"), productName: "Galaxy S24", sku: "SAM-S24-001", quantity: 1, unitPrice: 95000, lineTotal: 95000, costPrice: 85000 },
      { product: ObjectId("650000000000000000000307"), productName: "M331 Silent Mouse", sku: "LOG-M331-001", quantity: 2, unitPrice: 1800, lineTotal: 3600, costPrice: 1400 },
    ],
    subtotal: 98600, discount: 600, grandTotal: 98000, paidAmount: 50000, outstandingAmount: 48000, returnedAmount: 0,
    paymentStatus: "PARTIALLY_PAID", status: "COMPLETED", walkInPaymentMethod: null,
    createdBy: ObjectId("650000000000000000000002"),
  },
  {
    // A walk-in sale: no customer, so the full amount is paid at once
    _id: ObjectId("650000000000000000000602"), saleNumber: "SAL-000002",
    customer: null, saleDate: ISODate("2026-11-03T08:30:00Z"),
    items: [
      { product: ObjectId("650000000000000000000305"), productName: "JBL Go 3", sku: "JBL-GO3-001", quantity: 2, unitPrice: 4000, lineTotal: 8000, costPrice: 3200 },
    ],
    subtotal: 8000, discount: 0, grandTotal: 8000, paidAmount: 8000, outstandingAmount: 0, returnedAmount: 0,
    paymentStatus: "PAID", status: "COMPLETED", walkInPaymentMethod: "CASH",
    createdBy: ObjectId("650000000000000000000002"),
  },
  {
    _id: ObjectId("650000000000000000000603"), saleNumber: "SAL-000003",
    customer: ObjectId("650000000000000000000402"), saleDate: ISODate("2026-11-05T10:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000303"), productName: "Dell Inspiron 15", sku: "DEL-INS15-001", quantity: 1, unitPrice: 70000, lineTotal: 70000, costPrice: 62000 },
      { product: ObjectId("650000000000000000000306"), productName: "JBL Flip 6", sku: "JBL-FLP6-001", quantity: 1, unitPrice: 12500, lineTotal: 12500, costPrice: 10500 },
    ],
    subtotal: 82500, discount: 0, grandTotal: 82500, paidAmount: 0, outstandingAmount: 82500, returnedAmount: 0,
    paymentStatus: "UNPAID", status: "COMPLETED", walkInPaymentMethod: null,
    createdBy: ObjectId("650000000000000000000002"),
  },
  {
    // Saved at 19:30 UTC on 7 November, which is 01:30 on 8 November in Bangladesh (UTC+6)
    _id: ObjectId("650000000000000000000604"), saleNumber: "SAL-000004",
    customer: ObjectId("650000000000000000000403"), saleDate: ISODate("2026-11-07T19:30:00Z"),
    items: [
      { product: ObjectId("650000000000000000000302"), productName: "Galaxy A15", sku: "SAM-A15-001", quantity: 1, unitPrice: 21000, lineTotal: 21000, costPrice: 18000 },
    ],
    subtotal: 21000, discount: 0, grandTotal: 21000, paidAmount: 21000, outstandingAmount: 0, returnedAmount: 0,
    paymentStatus: "PAID", status: "COMPLETED", walkInPaymentMethod: null,
    createdBy: ObjectId("650000000000000000000002"),
  },
  {
    // A draft: stock is not reduced yet
    _id: ObjectId("650000000000000000000605"), saleNumber: "SAL-000005",
    customer: ObjectId("650000000000000000000401"), saleDate: ISODate("2026-11-09T06:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000305"), productName: "JBL Go 3", sku: "JBL-GO3-001", quantity: 3, unitPrice: 4000, lineTotal: 12000, costPrice: null },
    ],
    subtotal: 12000, discount: 0, grandTotal: 12000, paidAmount: 0, outstandingAmount: 12000, returnedAmount: 0,
    paymentStatus: "UNPAID", status: "DRAFT", walkInPaymentMethod: null,
    createdBy: ObjectId("650000000000000000000002"),
  },
  {
    _id: ObjectId("650000000000000000000606"), saleNumber: "SAL-000006",
    customer: ObjectId("650000000000000000000402"), saleDate: ISODate("2026-11-09T07:00:00Z"),
    items: [
      { product: ObjectId("650000000000000000000307"), productName: "M331 Silent Mouse", sku: "LOG-M331-001", quantity: 1, unitPrice: 1800, lineTotal: 1800, costPrice: null },
    ],
    subtotal: 1800, discount: 0, grandTotal: 1800, paidAmount: 0, outstandingAmount: 1800, returnedAmount: 0,
    paymentStatus: "UNPAID", status: "CANCELLED", walkInPaymentMethod: null,
    createdBy: ObjectId("650000000000000000000002"),
  },
]);

// ---------- payments (money received from customers) ----------
db.payments.insertMany([
  { sale: ObjectId("650000000000000000000601"), customer: ObjectId("650000000000000000000401"), amount: 50000, method: "MOBILE_BANKING", reference: "BKASH-7781", createdBy: ObjectId("650000000000000000000002") },
  { sale: ObjectId("650000000000000000000602"), customer: null, amount: 8000, method: "CASH", reference: "", createdBy: ObjectId("650000000000000000000002") },
  { sale: ObjectId("650000000000000000000604"), customer: ObjectId("650000000000000000000403"), amount: 21000, method: "CARD", reference: "", createdBy: ObjectId("650000000000000000000002") },
]);

print("Practice data is ready: " + db.products.countDocuments() + " products, " + db.sales.countDocuments() + " sales, " + db.purchases.countDocuments() + " purchases.");
