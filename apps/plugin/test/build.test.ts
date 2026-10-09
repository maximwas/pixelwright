import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PLUGIN = fileURLToPath(new URL("..", import.meta.url));

describe("the plugin build", () => {
  it("bundles the main thread and the window, minified and without code they never run", () => {
    const out = mkdtempSync(join(tmpdir(), "pixelwright-plugin-"));
    const build = spawnSync("pnpm", ["run", "build", "--output", out], {
      cwd: PLUGIN,
      encoding: "utf8",
    });

    expect(build.status, `${build.stdout}${build.stderr}`).toBe(0);
    // The window only links Figma to the server: core's XML, CSS and token code belongs to the main thread alone.
    expect(statSync(join(out, "build", "ui.js")).size).toBeLessThan(160_000);
    expect(statSync(join(out, "build", "main.js")).size).toBeLessThan(350_000);
  }, 60_000);
});
