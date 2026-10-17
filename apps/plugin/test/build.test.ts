import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
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

    try {
      expect(build.status, `${build.stdout}${build.stderr}`).toBe(0);
      // The window only links Figma to the server: core's XML, CSS and token code belongs to the main thread alone.
      expect(statSync(join(out, "build", "ui.js")).size).toBeLessThan(160_000);
      // Each new operation moves this on purpose: bind took it past 360 KB, then texts, instances and the gradients past
      // 400 KB (2026-10-17, checked with esbuild's metafile: no package came in that should not).
      expect(statSync(join(out, "build", "main.js")).size).toBeLessThan(450_000);

      // Beside each bundle, the licences of the packages it carries: what their licences ask of a copy.
      const main = readFileSync(join(out, "build", "main.js.LICENSE.txt"), "utf8");
      const ui = readFileSync(join(out, "build", "ui.js.LICENSE.txt"), "utf8");

      for (const name of ["culori", "leven", "@csstools/css-tokenizer", "zod", "@create-figma-plugin/utilities"]) {
        expect(main, name).toContain(`## ${name}`);
      }

      expect(main).toContain("MIT License");
      expect(ui).toContain("## zod");
      expect(ui).not.toContain("## culori");

      // The bundles carry them too: a Figma plugin is loaded from its manifest and bundles alone.
      expect(readFileSync(join(out, "build", "main.js"), "utf8").includes(main)).toBe(true);
      expect(readFileSync(join(out, "build", "ui.js"), "utf8").includes(ui)).toBe(true);
    } finally {
      rmSync(out, {
        recursive: true,
        force: true,
      });
    }
  }, 60_000);
});
