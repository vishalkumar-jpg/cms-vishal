import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_APP_PORT) || 5001;
  return {
    plugins: [react(), tsconfigPaths()],
    server: {
      port,
      host: true,
      fs: {
        allow: [repoRoot],
      },
    },
    preview: { port },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@craftjs/")) return "craftjs";
            if (id.includes("node_modules/lucide-react")) return "lucide";
            if (id.includes("/packages/blocks/") || id.includes("@ob-cms/blocks")) {
              return "blocks";
            }
          },
        },
      },
    },
  };
});
