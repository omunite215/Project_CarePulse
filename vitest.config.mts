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
       *
       * It has to be a file path, not the bare specifier `server-only/empty`:
       * the package's `exports` map declares only `"."`, so any subpath is
       * unresolvable. Adding `react-server` to `resolve.conditions` would fix
       * the import too, but it would also swap React itself over to its server
       * build and break the component tests.
       */
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
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
