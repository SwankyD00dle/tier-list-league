import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  test: {
    include: ["**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
