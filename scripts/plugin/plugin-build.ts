import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type BuildOptions, build } from "esbuild";
import { PLUGIN_FILES } from "@/plugin/main/plugin.constants.ts";
import { PluginManifest } from "@/plugin/main/plugin-manifest.ts";
import type { Channel } from "@/shared/protocol/channel.constants.ts";
import { PluginNotices } from "./plugin-notices.ts";

/** Each bundle's entry: the root's start(), the only code that runs on load. */
const ENTRY = {
  main: 'import { PluginMain } from "@/plugin/main/plugin.main.ts";\nnew PluginMain().start();\n',
  ui: 'import { UiMain } from "@/plugin-ui/ui.main.ts";\nnew UiMain().start();\n',
};

/** Where ui.html takes the window's script. */
const SCRIPT_SLOT = "/* ui.js */";
const CLOSING_SCRIPT = /<\/script/i;

/**
 * The Figma plugin build (A§11.3, D-52): esbuild alone, no create-figma-plugin and no entry rewrite. main.js for the
 * main thread (neutral platform with the module and main fields, so a package with only "main" resolves: the slugify
 * trap), ui.html with the window's script inlined, manifest.json for the channel, each bundle with its notices. Both
 * targets are es2022 (P3): `#private` stays native, and the main sandbox parses it (P1). The tsconfigs give esbuild the
 * `@/` paths and legacy decorators.
 */
export class PluginBuild {
  readonly #root: string;
  readonly #out: string;

  constructor(root: string, out: string) {
    this.#root = root;
    this.#out = out;
  }

  async run(channel: Channel): Promise<void> {
    const main = await this.#bundle(ENTRY.main, {
      platform: "neutral",
      mainFields: ["module", "main"],
      tsconfig: join(this.#root, "tsconfig.plugin.json"),
    });
    const ui = await this.#bundle(ENTRY.ui, { platform: "browser", tsconfig: join(this.#root, "tsconfig.ui.json") });

    // An inline script ends at the first `</script`, wherever it stands: esbuild escapes it in strings, this proves it.
    if (CLOSING_SCRIPT.test(ui)) {
      throw new Error("The window's script holds </script and cannot be inlined into ui.html.");
    }

    const page = await readFile(join(this.#root, "src/plugin-ui/ui.html"), "utf8");

    await rm(this.#out, { recursive: true, force: true });
    await mkdir(this.#out, { recursive: true });
    await writeFile(join(this.#out, PLUGIN_FILES.main), main);
    // A function, so `$&` and its kin in the script are not read as replacement patterns.
    await writeFile(
      join(this.#out, PLUGIN_FILES.ui),
      page.replace(SCRIPT_SLOT, () => ui),
    );
    await writeFile(
      join(this.#out, PLUGIN_FILES.manifest),
      `${JSON.stringify(new PluginManifest(channel).json(), null, 2)}\n`,
    );
  }

  async #bundle(entry: string, options: BuildOptions): Promise<string> {
    const notices = new PluginNotices(this.#root);
    const result = await build({
      stdin: { contents: entry, resolveDir: this.#root, loader: "ts" },
      absWorkingDir: this.#root,
      bundle: true,
      format: "iife",
      target: "es2022",
      minify: true,
      metafile: true,
      write: false,
      logLevel: "warning",
      ...options,
    });
    const code = result.outputFiles?.[0]?.text;

    if (code === undefined || result.metafile === undefined) {
      throw new Error("esbuild returned no bundle or no metafile.");
    }

    return `${code}${notices.comment(notices.text(result.metafile))}`;
  }
}
