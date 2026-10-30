import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { HOME_MODE, PLUGIN_FILE, SETUP_TEXT } from "@/cli/setup/setup.constants.ts";
import { PluginManifestSchema } from "@/cli/setup/setup.schema.ts";
import type { PluginFiles } from "@/cli/setup/setup.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/**
 * The one copy path of the Figma plugin (S-062), for the setup and `pnpm plugin:install`: Figma Desktop cannot read
 * ~/Desktop, Documents or Downloads (FX-014), so the plugin goes to the channel's home. Only its own older copy is
 * replaced, and that copy goes first, so every open window of the plugin reloads with the new one (R-037).
 */
@injectable()
export class PluginCopy implements PluginFiles {
  /** dist/plugin beside the bundle in the package, or the repository's build when run from source; null when neither. */
  packaged(): string | null {
    const found = PLUGIN_FILE.sources
      .map((relative) => fileURLToPath(new URL(relative, import.meta.url)))
      .find((folder) => existsSync(join(folder, PLUGIN_FILE.manifest)));

    return found ?? null;
  }

  /** Copies the plugin from `from` to `to`; resolves with the manifest's path, for Import plugin from manifest. */
  async install(from: string, to: string): Promise<string> {
    if (!existsSync(join(from, PLUGIN_FILE.manifest))) {
      throw new Error(SETUP_TEXT.noManifest(from));
    }

    await this.#refuseOtherFiles(to);
    await mkdir(dirname(to), { recursive: true, mode: HOME_MODE });
    await rm(to, { recursive: true, force: true });
    await cp(from, to, { recursive: true });

    return join(to, PLUGIN_FILE.manifest);
  }

  /** Throws unless `to` is missing, empty, or an older copy of this channel's plugin. */
  async #refuseOtherFiles(to: string): Promise<void> {
    const entries = await readdir(to).catch((): string[] => []);

    if (entries.length > 0 && !(await this.#ownCopy(to))) {
      throw new Error(SETUP_TEXT.notPluginFolder(to, entries));
    }
  }

  /** Whether `to` holds a copy of this channel's plugin: its manifest names it. */
  async #ownCopy(to: string): Promise<boolean> {
    try {
      const manifest = JSON.parse(await readFile(join(to, PLUGIN_FILE.manifest), PLUGIN_FILE.encoding));

      return zod.safeParse(PluginManifestSchema, manifest).data?.name === CHANNEL.pluginName;
    } catch {
      // No readable manifest: not a copy of the plugin.
      return false;
    }
  }
}
