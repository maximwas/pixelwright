// `pnpm plugin:install`: copies the built plugin (dist/plugin, `pnpm build`) to <home>/plugin through the setup's own
// PluginCopy, where Figma Desktop can read it: it cannot read ~/Desktop, Documents or Downloads (FX-014). The old copy
// goes first, so every open window of this plugin reloads with the new build (S-062): run it while Test MCP is the
// only file with the plugin open (R-037).
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginCopy } from "@/cli/setup/plugin-copy.ts";
import { ConfigReader } from "@/server/main/config/config-reader.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

class PluginInstall {
  readonly #source = fileURLToPath(new URL("../dist/plugin", import.meta.url));

  async run(): Promise<void> {
    const target = join(new ConfigReader().read().home, "plugin");
    const manifest = await new PluginCopy().install(this.#source, target);

    process.stdout.write(
      `${CHANNEL.pluginName} installed in ${target}: every open window of it reloads now.\n` +
        `First time: in Figma Desktop, Plugins → Development → Import plugin from manifest… → ${manifest}\n`,
    );
  }
}

await new PluginInstall().run();
