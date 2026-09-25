import type { Config } from "tailwindcss";
// CJS preset (untyped) — cast to the partial Config shape Tailwind expects.
import presetModule from "@ob-cms/config/tailwind";

const preset = presetModule as Partial<Config>;

export default {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/blocks/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
