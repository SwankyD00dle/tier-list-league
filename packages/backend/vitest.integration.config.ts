import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
});
