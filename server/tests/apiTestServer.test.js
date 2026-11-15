import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../src/scripts/apiTestServer.js";

// The API test server must always point at the test database, whatever is in server/.env
describe("useTestDatabase", () => {
  it("replaces the database name and keeps the options", () => {
    expect(useTestDatabase("mongodb+srv://user:pass@cluster0.abc.mongodb.net/inventory_management_system?retryWrites=true&w=majority"))
      .toBe("mongodb+srv://user:pass@cluster0.abc.mongodb.net/stockpilot_api_test?retryWrites=true&w=majority");
  });

  it("adds the database name when the connection string has none", () => {
    expect(useTestDatabase("mongodb+srv://user:pass@cluster0.abc.mongodb.net/?appName=App"))
      .toBe("mongodb+srv://user:pass@cluster0.abc.mongodb.net/stockpilot_api_test?appName=App");
    expect(useTestDatabase("mongodb://localhost:27017")).toBe("mongodb://localhost:27017/stockpilot_api_test");
  });

  it("keeps an encoded password unchanged", () => {
    expect(useTestDatabase("mongodb+srv://user:p%40ss%2Fword@host.net/realdb"))
      .toBe("mongodb+srv://user:p%40ss%2Fword@host.net/stockpilot_api_test");
  });

  it("returns null for a missing or wrong value", () => {
    expect(useTestDatabase(undefined)).toBeNull();
    expect(useTestDatabase("<cluster-host>")).toBeNull();
  });
});
