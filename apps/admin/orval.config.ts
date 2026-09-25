import { defineConfig } from "orval";

/**
 * SDK flow (mirrors boilerplate): backend change → run api → `bun run
 * orval-generate` reads the live OpenAPI doc at /docs-json → generates typed
 * TanStack Query hooks + types into src/sdk. NEVER edit src/sdk by hand; wrap
 * hooks under views/<feature>/hooks/ and key them with QUERY_KEYS.
 *
 * The mutator (AxiosService.request) sets baseURL=/api and unwraps the
 * ResponseDto envelope.
 */
export default defineConfig({
  obCmsApi: {
    output: {
      mode: "tags",
      target: "./src/sdk/",
      client: "react-query",
      httpClient: "axios",
      clean: true,
      tsconfig: "./tsconfig.orval.json",
      override: {
        mutator: {
          path: "./src/services/AxiosService.ts",
          name: "request",
        },
      },
    },
    input: {
      target: `${process.env.VITE_ORVAL_API_URL ?? "http://localhost:3001"}/docs-json`,
    },
  },
});
