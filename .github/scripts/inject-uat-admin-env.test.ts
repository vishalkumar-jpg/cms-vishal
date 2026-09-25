import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "inject-uat-admin-env.sh");
const UAT_PLATFORM_BASE_DOMAIN = "uat-cms.officebeacon.net";

describe("inject-uat-admin-env.sh", () => {
  let tempDir: string;
  let envFile: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("injects and verifies VITE_PLATFORM_BASE_DOMAIN for UAT Admin builds", () => {
    tempDir = mkdtempSync(join(tmpdir(), "uat-admin-env-"));
    envFile = join(tempDir, ".env");
    writeFileSync(
      envFile,
      [
        "VITE_API_URL=http://localhost:3001",
        "VITE_RENDERER_BASE_URL=http://localhost:3000",
        "VITE_PLATFORM_BASE_DOMAIN=wrong.example.com",
        "AUTH0_DOMAIN=example.auth0.com",
      ].join("\n"),
      "utf8",
    );

    const result = spawnSync("bash", [SCRIPT, envFile], { encoding: "utf8" });
    expect(result.status).toBe(0);

    const contents = readFileSync(envFile, "utf8");
    expect(contents).toContain("VITE_API_URL=https://uat-cms-api.officebeacon.net");
    expect(contents).toContain("VITE_RENDERER_BASE_URL=https://uat-cms.officebeacon.net");
    expect(contents).toContain(`VITE_PLATFORM_BASE_DOMAIN=${UAT_PLATFORM_BASE_DOMAIN}`);
    expect(contents).not.toContain("wrong.example.com");
    expect(contents).not.toContain("localhost:3001");
    expect(contents).toContain("AUTH0_DOMAIN=example.auth0.com");
  });

  it("handles env files without a trailing newline", () => {
    tempDir = mkdtempSync(join(tmpdir(), "uat-admin-env-"));
    envFile = join(tempDir, ".env");
    writeFileSync(envFile, "AUTH0_DOMAIN=example.auth0.com", "utf8");

    const result = spawnSync("bash", [SCRIPT, envFile], { encoding: "utf8" });
    expect(result.status).toBe(0);

    const contents = readFileSync(envFile, "utf8");
    expect(contents).toContain("AUTH0_DOMAIN=example.auth0.com\nVITE_API_URL=");
    expect(contents).toContain(`VITE_PLATFORM_BASE_DOMAIN=${UAT_PLATFORM_BASE_DOMAIN}`);
  });

  it("fails when the env file path is missing", () => {
    const result = spawnSync("bash", [SCRIPT, "/nonexistent/.env"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
  });
});
