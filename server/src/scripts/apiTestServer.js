import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Starts the normal API server, but connected to a separate test database.
// It is used for the Postman tests (docs/api), so the real data is never changed.
//
//   pnpm dev:apitest            start on http://localhost:5050
//   pnpm dev:apitest --reset    empty the test database first
//
// The cluster and the login of server/.env are used. Only the database name is replaced.

const TEST_DB = "stockpilot_api_test";
const TEST_PORT = "5050";
const TEST_USERS = [
  { name: "Test Admin", email: "admin@stockpilot.test", password: "AdminPass123", role: "ADMINISTRATOR" },
  { name: "Test Staff", email: "staff@stockpilot.test", password: "StaffPass123", role: "STAFF" },
];

// Replaces the database name in a MongoDB connection string
export function useTestDatabase(uri) {
  const match = /^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/.exec(uri || "");
  if (!match) return null;
  return `${match[1]}/${TEST_DB}${match[3] || ""}`;
}

async function main() {
  const testUri = useTestDatabase(process.env.MONGO_URI);
  if (!testUri) {
    console.error("MONGO_URI is missing or not a MongoDB connection string. Check server/.env");
    process.exit(1);
  }

  // These are set before the server file is loaded. dotenv does not replace values that already exist
  process.env.MONGO_URI = testUri;
  process.env.PORT = TEST_PORT;

  await import("../server.js");
  await mongoose.connection.asPromise();

  // A second check, so nothing below can ever run on another database
  if (mongoose.connection.name !== TEST_DB) {
    console.error(`Connected to "${mongoose.connection.name}", expected "${TEST_DB}". Stopping.`);
    process.exit(1);
  }

  if (process.argv.includes("--reset")) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
    console.log(`Test database emptied (${collections.length} collections).`);
  }

  const { default: User } = await import("../models/User.js");
  for (const user of TEST_USERS) {
    const exists = await User.exists({ email: user.email });
    if (!exists) {
      await User.create({
        name: user.name,
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, 12),
        role: user.role,
        isActive: true,
      });
    }
  }

  console.log("");
  console.log(`API test server is ready. Database: ${TEST_DB}`);
  console.log(`Postman baseUrl: http://localhost:${TEST_PORT}/api/v1`);
  console.log("Test logins (they exist only in the test database):");
  for (const user of TEST_USERS) {
    console.log(`  ${user.role}: ${user.email} / ${user.password}`);
  }
}

// The file is also imported by a unit test, which must not start the server
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/apiTestServer.js")) {
  main().catch((error) => {
    console.error("Could not start the API test server:", error.message);
    process.exit(1);
  });
}
