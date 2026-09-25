import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderResponsiveBreakpointCss } from "../src/responsive-breakpoint-css.ts";

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../blocks/src/blocks-responsive-overrides.css",
);

writeFileSync(out, renderResponsiveBreakpointCss(), "utf8");
console.log(`Wrote ${out}`);
