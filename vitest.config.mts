import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      /**
       * `server-only` throws on import unless the bundler sets the
       * `react-server` export condition, which Vitest does not. Aliasing to the
       * package's own no-op entry keeps the guard meaningful in the real build
       * while letting the modules be unit tested.
       */
      "server-only": "server-only/empty",
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "lib/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "scripts/**"],
    restoreMocks: true,
  },
});
