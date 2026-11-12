import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Metafile } from "esbuild";
import { describe, expect, it } from "vitest";
import { PluginNotices } from "./plugin-notices.ts";

/** A package installed the way pnpm does, under node_modules/.pnpm/<id>/node_modules/<name>. */
const install = (
  root: string,
  name: string,
  licence: string,
) => {
  const folder = join(root, "node_modules/.pnpm", `${name}@1.0.0`, "node_modules", name);

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "package.json"), JSON.stringify({ version: "1.0.0", license: "MIT" }));
  writeFileSync(join(folder, "LICENSE"), licence);

  return `node_modules/.pnpm/${name}@1.0.0/node_modules/${name}/index.js`;
};

describe("PluginNotices", () => {
  it("names only the packages the bundle kept bytes of, and its comment cannot end early", () => {
    const root = mkdtempSync(join(tmpdir(), "pixelwright-notices-"));
    const kept = install(root, "kept", "Copyright Kept */ </script>");
    const dropped = install(root, "dropped", "Copyright Dropped");
    const metafile: Metafile = {
      inputs: {},
      outputs: {
        "main.js": {
          bytes: 15,
          imports: [],
          exports: [],
          entryPoint: "<stdin>",
          inputs: {
            [kept]: { bytesInOutput: 10 },
            [dropped]: { bytesInOutput: 0 },
            "src/plugin/main/plugin.main.ts": { bytesInOutput: 5 },
          },
        },
      },
    };
    const notices = new PluginNotices(root);
    const text = notices.text(metafile);
    const comment = notices.comment(text);

    expect(text).toContain("## kept\n\n1.0.0, MIT\n\nCopyright Kept */ </script>");
    expect(text).not.toContain("dropped");
    expect(comment.startsWith("\n/*!\n")).toBe(true);
    expect(comment.slice(0, -3)).not.toMatch(/\*\/|<\/script/);
  });
});
