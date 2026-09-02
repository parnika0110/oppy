import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "app", "components", "scripts"],
    alias: {
      "server-only": path.resolve(__dirname, "lib/__mocks__/server-only.ts"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
