import swc from "unplugin-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * e2e test runner. Uses unplugin-swc so Nest decorators/metadata work, and
 * vite-tsconfig-paths so the `@/`, `@common/`, `@database/` … aliases resolve.
 * Tests hit a real Postgres (5433) — run migrations first.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    globals: true,
    environment: "node",
    hookTimeout: 60_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2023",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
    }),
  ],
});
