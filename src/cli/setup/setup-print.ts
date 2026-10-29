import { inject, injectable } from "@needle-di/core";
import { COMMAND, EXIT_CODE } from "@/cli/main/cli.constants.ts";
import { CLI_STREAMS, PLUGIN_COPY, SETUP_SETTINGS } from "@/cli/main/cli.tokens.ts";
import type { CliCommand } from "@/cli/main/cli.types.ts";
import { MCP_CLIENTS } from "@/cli/setup/mcp-clients.ts";
import { SETUP_TEXT } from "@/cli/setup/setup.constants.ts";

/** `setup --print` (S-064), for scripts and CI: no questions, every client's way in and the plugin's path. */
@injectable()
export class SetupPrint implements CliCommand {
  readonly name = COMMAND.setupPrint;
  readonly #clients;
  readonly #copy;
  readonly #settings;
  readonly #streams;

  constructor(
    clients = inject(MCP_CLIENTS),
    copy = inject(PLUGIN_COPY),
    settings = inject(SETUP_SETTINGS),
    streams = inject(CLI_STREAMS),
  ) {
    this.#clients = clients;
    this.#copy = copy;
    this.#settings = settings;
    this.#streams = streams;
  }

  /** The plugin is put in place first, so the path the text gives is there. */
  async run(): Promise<number> {
    try {
      const from = this.#copy.packaged();
      const manifest = from === null ? null : await this.#copy.install(from, this.#settings.pluginHome);

      this.#streams.stdout.write(
        SETUP_TEXT.print([
          SETUP_TEXT.claudeBlock(this.#clients.claudeCodeCommand()),
          SETUP_TEXT.cursorBlock(this.#clients.configBlock()),
          SETUP_TEXT.codexBlock(this.#clients.codexBlock()),
          manifest === null ? SETUP_TEXT.pluginNone : SETUP_TEXT.pluginBlock(manifest),
        ]),
      );

      return EXIT_CODE.ok;
    } catch (error) {
      this.#streams.stderr.write(SETUP_TEXT.line(error instanceof Error ? error.message : String(error)));

      return EXIT_CODE.failed;
    }
  }
}
