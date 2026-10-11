import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "~/*" path alias from tsconfig.json
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["{src,infra}/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
