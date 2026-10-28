// `pnpm plugin:install`: copies the built plugin (dist/plugin, `pnpm build`) to <home>/plugin, where Figma Desktop can
// read it: it cannot read ~/Desktop, Documents or Downloads (FX-014). The old copy goes first, so every open window of
// this plugin reloads with the new build (S-062): run it while Test MCP is the only file with the plugin open (R-037).
import { access, cp, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGIN_FILES } from "@/plugin/main/plugin-manifest/plugin-manifest.constants.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

class PluginInstall {
  readonly #source = fileURLToPath(new URL("../dist/plugin", import.meta.url));

  async run(env: NodeJS.ProcessEnv): Promise<void> {
    const home = env.PIXELWRIGHT_HOME?.trim() || join(homedir(), CHANNEL.home);
    const target = join(home, "plugin");

    await access(join(this.#source, PLUGIN_FILES.manifest)).catch(() => {
      throw new Error(`No built plugin in ${this.#source}: run pnpm build first.`);
    });
    // The home also holds bridge.json's keys: only its owner reads it.
    await mkdir(home, {
      recursive: true,
      mode: 0o700,
    });
    await rm(target, {
      recursive: true,
      force: true,
    });
    await cp(this.#source, target, { recursive: true });
    process.stdout.write(
      `${CHANNEL.pluginName} installed in ${target}: every open window of it reloads now.\n` +
        `First time: in Figma Desktop, Plugins → Development → Import plugin from manifest… → ${join(target, PLUGIN_FILES.manifest)}\n`,
    );
  }
}

await new PluginInstall().run(process.env);
