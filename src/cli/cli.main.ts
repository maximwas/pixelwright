import { homedir } from "node:os";
import { join } from "node:path";
import { Container } from "@needle-di/core";
import { COMMAND_LINE } from "@/cli/main/command-line.ts";
import { CommandProviders } from "@/cli/main/command-providers.ts";
import { NPX_INVOCATION, PLUGIN_FILE } from "@/cli/setup/setup.constants.ts";
import type { Invocation } from "@/cli/setup/setup.types.ts";
import { ConfigReader } from "@/server/main/config/config-reader.ts";
import { LOG_FILE } from "@/server/main/server.constants.ts";
import { CHANNEL, CHANNELS } from "@/shared/protocol/channel.constants.ts";

/**
 * The pixelwright binary's composition root (A§4.2): one container per run with the commands, and the command line
 * runs the one the arguments name. The server keeps its own root, ServerMain, which `serve` starts.
 */
export class CliMain {
  async run(args: readonly string[]): Promise<void> {
    process.exitCode = await this.container().get(COMMAND_LINE).run(args);
  }

  /** The CLI's container; the composition test resolves every token of it. Everything it names comes from CHANNEL. */
  container(): Container {
    const container = new Container();
    const { home } = new ConfigReader().read();

    new CommandProviders().register(container, {
      setup: {
        userHome: homedir(),
        pluginHome: join(home, PLUGIN_FILE.folder),
        platform: process.platform,
        invocation: this.#invocation(),
      },
      logs: { file: join(home, LOG_FILE.folder, LOG_FILE.name) },
    });

    return container;
  }

  /**
   * How MCP clients start the server: the release from npm; the dev channel by this very build, since npm's
   * pixelwright is the other channel's product.
   */
  #invocation(): Invocation {
    return CHANNEL.name === CHANNELS.release.name
      ? NPX_INVOCATION
      : { command: process.execPath, args: [process.argv[1] ?? process.execPath] };
  }
}
