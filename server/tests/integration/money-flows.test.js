import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import Category from "../../src/models/Category.js";
import Brand from "../../src/models/Brand.js";
import Product from "../../src/models/Product.js";
import Customer from "../../src/models/Customer.js";
import Supplier from "../../src/models/Supplier.js";
import Sale from "../../src/models/Sale.js";
import Payment from "../../src/models/Payment.js";
import Purchase from "../../src/models/Purchase.js";
import Return from "../../src/models/Return.js";
import StockMovement from "../../src/models/StockMovement.js";
import SupplierPayment from "../../src/models/SupplierPayment.js";
import { createSale, completeSale } from "../../src/controllers/saleController.js";
import { addPayment } from "../../src/controllers/paymentController.js";
import { createPurchase } from "../../src/controllers/purchaseController.js";
import { completePurchase } from "../../src/controllers/purchaseStatusController.js";
import { createCustomerReturn, getReturnableItems } from "../../src/controllers/returnController.js";
import { createSupplierReturn } from "../../src/controllers/supplierReturnController.js";
import { cancelReturn } from "../../src/controllers/returnCancelController.js";
import { addSupplierPayment, getPurchasePayments } from "../../src/controllers/supplierPaymentController.js";

// These tests use the real MongoDB Atlas cluster from server/.env, but a SEPARATE database.
// The database below is created for the test and deleted at the end. The app's own data is not touched.
const TEST_DB = "stockpilot_integration_test";

const userId = new mongoose.Types.ObjectId();
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { _id: userId, role: "ADMINISTRATOR" };
  next();
});
app.post("/sales", createSale);
app.post("/sales/:id/complete", completeSale);
app.post("/sales/:id/payments", addPayment);
app.post("/purchases", createPurchase);
app.post("/purchases/:id/complete", completePurchase);
app.post("/purchases/:id/payments", addSupplierPayment);
app.get("/purchases/:id/payments", getPurchasePayments);
app.post("/returns/customer", createCustomerReturn);
app.get("/returns/sales/:saleId/returnable", getReturnableItems);
app.post("/returns/supplier", createSupplierReturn);
app.post("/returns/:id/cancel", cancelReturn);

let product;
let customer;
let supplier;

const stockOf = async () => (await Product.findById(product._id)).currentStock;

async function makeSale(quantity, extra = {}) {
  const created = await request(app)
    .post("/sales")
    .send({ items: [{ productId: String(product._id), quantity }], ...extra });
  expect(created.status).toBe(201);
  const completed = await request(app).post(`/sales/${created.body.data._id}/complete`);
  expect(completed.status).toBe(200);
  return completed.body.data;
}

async function makePurchase(quantity, unitPrice) {
  const created = await request(app)
    .post("/purchases")
    .send({ supplier: String(supplier._id), items: [{ productId: String(product._id), quantity, unitPrice }] });
  expect(created.status).toBe(201);
  const completed = await request(app).post(`/purchases/${created.body.data._id}/complete`);
  expect(completed.status).toBe(200);
  return Purchase.findById(created.body.data._id);
}

beforeAll(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
  await mongoose.connect(process.env.MONGO_URI, { dbName: TEST_DB });
  expect(mongoose.connection.db.databaseName).toBe(TEST_DB);
  await mongoose.connection.db.dropDatabase();
  // Collections must exist before they are used inside a transaction
  for (const model of [Category, Brand, Product, Customer, Supplier, Sale, Payment, Purchase, Return, StockMovement, SupplierPayment]) {
    await model.createCollection();
    await model.syncIndexes();
  }

  const category = await Category.create({ name: "Test category" });
  const brand = await Brand.create({ name: "Test brand" });
  product = await Product.create({
    name: "Test speaker",
    sku: "TEST-INT-001",
    category: category._id,
    brand: brand._id,
    purchasePrice: 50,
    sellingPrice: 100,
    currentStock: 20,
    unit: "pcs",
  });
  customer = await Customer.create({ name: "Test customer" });
  supplier = await Supplier.create({ name: "Test supplier" });
}, 120000);

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    // Safety check: only ever delete the test database
    if (mongoose.connection.db.databaseName === TEST_DB) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  }
}, 120000);

describe("walk-in sale", () => {
  it("is paid in full when completed, with the chosen method", async () => {
    const before = await stockOf();
    const sale = await makeSale(2, { paymentMethod: "MOBILE_BANKING" });

    expect(sale.paymentStatus).toBe("PAID");
    expect(sale.paidAmount).toBe(200);
    expect(sale.outstandingAmount).toBe(0);
    expect(await stockOf()).toBe(before - 2);

    const payments = await Payment.find({ sale: sale._id });
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(200);
    expect(payments[0].method).toBe("MOBILE_BANKING");
  });

  it("a sale to a named customer is still left unpaid", async () => {
    const sale = await makeSale(1, { customer: String(customer._id) });
    expect(sale.paymentStatus).toBe("UNPAID");
    expect(sale.outstandingAmount).toBe(100);
    expect(await Payment.countDocuments({ sale: sale._id })).toBe(0);
  });
});

describe("cancel a customer return", () => {
  it("puts the products out of stock again and restores the balance", async () => {
    const sale = await makeSale(3, { customer: String(customer._id) });
    const stockAfterSale = await stockOf();

    const ret = await request(app)
      .post("/returns/customer")
      .send({ saleId: String(sale._id), items: [{ productId: String(product._id), quantity: 1 }], reason: "Wrong colour" });
    expect(ret.status).toBe(201);
    expect(ret.body.data.sale.outstandingAmount).toBe(200);
    expect(await stockOf()).toBe(stockAfterSale + 1);

    const returnId = ret.body.data.return._id;
    const cancelled = await request(app).post(`/returns/${returnId}/cancel`).send({ reason: "Saved by mistake" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    expect(await stockOf()).toBe(stockAfterSale);
    const saleNow = await Sale.findById(sale._id);
    expect(saleNow.outstandingAmount).toBe(300);
    expect(saleNow.returnedAmount).toBe(0);
    expect(saleNow.paymentStatus).toBe("UNPAID");

    const movement = await StockMovement.findOne({ type: "RETURN_CANCELLED", product: product._id }).sort({ createdAt: -1 });
    expect(movement.change).toBe(-1);

    // The cancelled return no longer counts, so all 3 can be returned again
    const returnable = await request(app).get(`/returns/sales/${sale._id}/returnable`);
    expect(returnable.body.data.items[0].remaining).toBe(3);

    // A second cancel is refused
    const again = await request(app).post(`/returns/${returnId}/cancel`).send({ reason: "Again" });
    expect(again.status).toBe(409);
  });

  it("refuses to cancel a return that refunded cash", async () => {
    const sale = await makeSale(1, { customer: String(customer._id) });
    const paid = await request(app).post(`/sales/${sale._id}/payments`).send({ amount: 100, method: "CASH" });
    expect(paid.status).toBe(201);

    const ret = await request(app)
      .post("/returns/customer")
      .send({ saleId: String(sale._id), items: [{ productId: String(product._id), quantity: 1 }], reason: "Broken", refundMethod: "CASH" });
    expect(ret.status).toBe(201);
    expect(ret.body.data.return.cashRefund).toBe(100);

    const cancelled = await request(app).post(`/returns/${ret.body.data.return._id}/cancel`).send({ reason: "Try" });
    expect(cancelled.status).toBe(409);
  });

  it("only one of two cancels at the same moment succeeds", async () => {
    const sale = await makeSale(2, { customer: String(customer._id) });
    const ret = await request(app)
      .post("/returns/customer")
      .send({ saleId: String(sale._id), items: [{ productId: String(product._id), quantity: 1 }], reason: "Test" });
    const stockBefore = await stockOf();

    const [a, b] = await Promise.all([
      request(app).post(`/returns/${ret.body.data.return._id}/cancel`).send({ reason: "One" }),
      request(app).post(`/returns/${ret.body.data.return._id}/cancel`).send({ reason: "Two" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await stockOf()).toBe(stockBefore - 1);
  });
});

describe("supplier payments", () => {
  it("tracks paid and outstanding, and never overpays", async () => {
    const purchase = await makePurchase(5, 50); // bill 250

    const first = await request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 100, method: "BANK_TRANSFER", reference: "TRX-1" });
    expect(first.status).toBe(201);
    expect(first.body.data.purchase.outstandingAmount).toBe(150);

    const tooMuch = await request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 200, method: "CASH" });
    expect(tooMuch.status).toBe(409);

    // Return 1 to the supplier (value 50): we owe 100 now
    const ret = await request(app)
      .post("/returns/supplier")
      .send({ purchaseId: String(purchase._id), items: [{ productId: String(product._id), quantity: 1 }], reason: "Damaged in box" });
    expect(ret.status).toBe(201);
    const tooMuchAfterReturn = await request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 150, method: "CASH" });
    expect(tooMuchAfterReturn.status).toBe(409);

    // Cancel the supplier return: stock comes back and we owe 150 again
    const stockBefore = await stockOf();
    const cancelled = await request(app).post(`/returns/${ret.body.data.return._id}/cancel`).send({ reason: "Supplier refused" });
    expect(cancelled.status).toBe(200);
    expect(await stockOf()).toBe(stockBefore + 1);
    expect((await Purchase.findById(purchase._id)).returnedAmount).toBe(0);

    const rest = await request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 150, method: "CASH" });
    expect(rest.status).toBe(201);
    expect(rest.body.data.purchase.outstandingAmount).toBe(0);

    const extra = await request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 1, method: "CASH" });
    expect(extra.status).toBe(409);

    const history = await request(app).get(`/purchases/${purchase._id}/payments`);
    expect(history.body.count).toBe(2);
    expect(history.body.totalPaid).toBe(250);
  });

  it("two payments at the same moment cannot overpay", async () => {
    const purchase = await makePurchase(5, 50); // bill 250
    const [a, b] = await Promise.all([
      request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 150, method: "CASH" }),
      request(app).post(`/purchases/${purchase._id}/payments`).send({ amount: 150, method: "CASH" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await Purchase.findById(purchase._id)).paidAmount).toBe(150);
  });

  it("a draft purchase cannot be paid", async () => {
    const created = await request(app)
      .post("/purchases")
      .send({ supplier: String(supplier._id), items: [{ productId: String(product._id), quantity: 1, unitPrice: 50 }] });
    const res = await request(app).post(`/purchases/${created.body.data._id}/payments`).send({ amount: 10, method: "CASH" });
    expect(res.status).toBe(409);
  });
});
