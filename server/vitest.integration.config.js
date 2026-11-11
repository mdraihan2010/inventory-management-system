import { defineConfig } from "vitest/config";

// `pnpm test:integration` runs the tests that use a temporary database on MongoDB Atlas
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.js"],
    testTimeout: 120000,
    hookTimeout: 120000,
    // One file at a time, so the tests never share the temporary database
    fileParallelism: false,
  },
});
