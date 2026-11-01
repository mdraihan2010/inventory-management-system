import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { protect, authorize } from "../src/middleware/authMiddleware.js";
import authRoutes from "../src/routes/authRoutes.js";
import { adjustStock } from "../src/controllers/inventoryController.js";

// These tests run without a database. Every path tested here is decided
// before the code touches MongoDB, so no Atlas connection is needed
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
  mongoose.set("bufferCommands", false);
});

describe("protect middleware (JWT check)", () => {
  const app = express();
  app.get("/private", protect, (req, res) => res.json({ ok: true }));

  it("returns 401 when no token is sent", async () => {
    const res = await request(app).get("/private");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Not authorized, token missing");
  });

  it("returns 401 for an invalid token", async () => {
    const res = await request(app)
      .get("/private")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Not authorized, token invalid or expired");
  });
});

describe("authorize middleware (role check)", () => {
  function runAuthorize(role, allowedRoles) {
    const req = { user: { role } };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json() { return this; },
    };
    const next = vi.fn();
    authorize(...allowedRoles)(req, res, next);
    return { res, next };
  }

  it("blocks a STAFF user from an Administrator-only action", () => {
    const { res, next } = runAuthorize("STAFF", ["ADMINISTRATOR"]);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets an Administrator through", () => {
    const { next } = runAuthorize("ADMINISTRATOR", ["ADMINISTRATOR"]);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("login rate limit", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  beforeEach(() => {
    // Without a database, login logs an error on each attempt. Hide that noise
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks the 11th login attempt within 15 minutes", async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "someone@example.com", password: "wrong-password" });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10).includes(429)).toBe(false);
    expect(statuses[10]).toBe(429);
  });
});

describe("adjustStock validation", () => {
  async function callAdjustStock(body) {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };
    const req = { body, user: { _id: new mongoose.Types.ObjectId() } };
    await adjustStock(req, res);
    return res;
  }

  const validId = new mongoose.Types.ObjectId().toString();

  it("rejects an invalid product id", async () => {
    const res = await callAdjustStock({ productId: "abc", type: "DAMAGED", quantity: 1 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid product id");
  });

  it("rejects an unknown movement type", async () => {
    const res = await callAdjustStock({ productId: validId, type: "STEAL", quantity: 1 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid movement type");
  });

  it("rejects a quantity of zero", async () => {
    const res = await callAdjustStock({ productId: validId, type: "DAMAGED", quantity: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Quantity must be a positive whole number");
  });

  it("requires a reason for an ADJUSTMENT", async () => {
    const res = await callAdjustStock({ productId: validId, type: "ADJUSTMENT", quantity: 2, reason: "  " });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("A reason is required for stock adjustment");
  });
});
