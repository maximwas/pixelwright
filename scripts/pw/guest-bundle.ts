import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ENTRY = new URL("../../src/server/adapters/sandbox/guest/pw-utils.ts", import.meta.url);
/** Where `@/` resolves for the guest's own imports. */
const TSCONFIG = new URL("../../tsconfig.server.json", import.meta.url);
const TARGET = new URL("../../src/server/adapters/sandbox/data/pw-utils.json", import.meta.url);
/** The guest module's name in the bundle: a local of the script around it, never a global of the run. */
const MODULE = "guest";

/**
 * The sandbox's utils as one script, written at build time (`pnpm build:pw`): esbuild 0.28.2 bundles the guest's
 * TypeScript with the packages it imports (culori/fn, es-toolkit, p-limit) for the browser platform, so a Node
 * built-in fails the build rather than a run, minified, since QuickJS evaluates it in every run. The script's value is
 * a function of pw that answers the utils; the prelude freezes them onto the run's global.
 */
export class GuestBundle {
  async source(): Promise<string> {
    const { outputFiles = [] } = await build({
      entryPoints: [fileURLToPath(ENTRY)],
      tsconfig: fileURLToPath(TSCONFIG),
      bundle: true,
      write: false,
      format: "iife",
      globalName: MODULE,
      platform: "browser",
      target: "es2023",
      minify: true,
    });

    return `(() => {\n${outputFiles.map(({ text }) => text).join("")}return (pw) => new ${MODULE}.PwUtils(pw);\n})()`;
  }

  async write(): Promise<void> {
    writeFileSync(TARGET, `${JSON.stringify({ source: await this.source() }, null, 2)}\n`);
  }
}
