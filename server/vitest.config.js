import { defineConfig } from "vitest/config";

// `pnpm test` runs the fast tests that need no database
export default defineConfig({
  test: {
    exclude: ["node_modules/**", "tests/integration/**"],
  },
});
