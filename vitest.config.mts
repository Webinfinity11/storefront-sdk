import { defineConfig } from "vitest/config";

// The SDK is its own package: no database, no environment, no setup files —
// just fetch, mocked.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: import.meta.dirname,
  },
});
