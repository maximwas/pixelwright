import { join } from "node:path";
import { inject, injectable } from "@needle-di/core";
import { COMMAND, EXIT_CODE } from "@/cli/main/cli.constants.ts";
import { PLUGIN_COPY, PROMPTS, SETUP_SETTINGS } from "@/cli/main/cli.tokens.ts";
import type { CliCommand } from "@/cli/main/cli.types.ts";
import { MCP_CLIENTS } from "@/cli/setup/mcp-clients.ts";
import { CLIENT_CONFIG, MCP_CLIENT, MCP_CLIENT_OPTIONS, SETUP_TEXT } from "@/cli/setup/setup.constants.ts";
import type { McpClient } from "@/cli/setup/setup.types.ts";
import { SetupCancelled } from "@/cli/setup/setup-cancelled.ts";

/**
 * The setup at a terminal (S-061..S-063): which MCP clients get the server, the Figma plugin put where Figma Desktop
 * can import it, and what to do in Figma. Every step can be skipped; a client that fails is said and the rest go on;
 * Ctrl+C at any question stops it there, with a word and exit code 1.
 */
@injectable()
export class SetupWizard implements CliCommand {
  readonly name = COMMAND.setup;
  readonly #prompts;
  readonly #clients;
  readonly #copy;
  readonly #settings;

  constructor(
    prompts = inject(PROMPTS),
    clients = inject(MCP_CLIENTS),
    copy = inject(PLUGIN_COPY),
    settings = inject(SETUP_SETTINGS),
  ) {
    this.#prompts = prompts;
    this.#clients = clients;
    this.#copy = copy;
    this.#settings = settings;
  }

  async run(): Promise<number> {
    try {
      await this.#steps();

      return EXIT_CODE.ok;
    } catch (error) {
      if (!(error instanceof SetupCancelled)) {
        throw error;
      }

      this.#prompts.cancel(error.message);

      return EXIT_CODE.failed;
    }
  }

  async #steps(): Promise<void> {
    this.#prompts.intro(SETUP_TEXT.intro);

    let connected = false;

    for (const client of await this.#chooseClients()) {
      connected = (await this.#connect(client)) || connected;
    }

    const manifest = await this.#placePlugin();
    const steps = [SETUP_TEXT.runPlugin, SETUP_TEXT.pair, SETUP_TEXT.allowEdits];

    this.#prompts.note(
      SETUP_TEXT.closing(manifest === null ? steps : [SETUP_TEXT.importPlugin(manifest), ...steps], connected),
      SETUP_TEXT.nextTitle,
    );
    this.#prompts.outro(SETUP_TEXT.done);
  }

  /** The clients to set up; those found on this computer come ticked. */
  async #chooseClients(): Promise<McpClient[]> {
    const found = await this.#clients.found();

    return this.#answered(
      await this.#prompts.multiselect({
        message: SETUP_TEXT.pick,
        options: MCP_CLIENT_OPTIONS.map(({ value, label }) => ({
          value,
          label,
          ...(found.includes(value) ? { hint: SETUP_TEXT.found } : {}),
        })),
        initialValues: found,
        required: false,
      }),
    );
  }

  /** One client; false when it could not be set up (said why). Ctrl+C at its questions stops the whole setup. */
  async #connect(client: McpClient): Promise<boolean> {
    try {
      if (client === MCP_CLIENT.claudeCode) {
        return await this.#connectClaudeCode();
      }

      if (client === MCP_CLIENT.cursor) {
        this.#prompts.log.success(await this.#clients.addToCursor(() => this.#confirm(SETUP_TEXT.cursorReplace)));
      } else if (client === MCP_CLIENT.codex) {
        await this.#connectCodex();
      } else {
        this.#prompts.note(this.#clients.configBlock(), SETUP_TEXT.otherTitle);
      }

      return true;
    } catch (error) {
      if (error instanceof SetupCancelled) {
        throw error;
      }

      this.#prompts.log.error(this.#message(error));

      return false;
    }
  }

  /** Claude Code through its claude command. The spinner stops on every path: a running one would keep the setup open. */
  async #connectClaudeCode(): Promise<boolean> {
    const working = this.#prompts.spinner();
    let spinning = true;

    working.start(SETUP_TEXT.claudeAdding);

    try {
      const outcome = await this.#clients.addToClaudeCode(() => {
        spinning = false;
        working.stop(SETUP_TEXT.claudeHas);

        return this.#confirm(SETUP_TEXT.replace);
      });

      if (spinning) {
        working.stop(outcome);
      } else {
        this.#prompts.log.success(outcome);
      }

      return true;
    } catch (error) {
      if (!spinning) {
        throw error;
      }

      working.error(this.#message(error));

      return false;
    }
  }

  /** Codex through `codex mcp add` when it is on PATH, else the TOML to paste. */
  async #connectCodex(): Promise<void> {
    const added = await this.#clients.addToCodex();

    if (added === null) {
      const file = join(this.#settings.userHome, CLIENT_CONFIG.codexFolder, CLIENT_CONFIG.codexFile);

      this.#prompts.note(this.#clients.codexBlock(), SETUP_TEXT.codexTitle(file));
    } else {
      this.#prompts.log.success(added);
    }
  }

  /** The plugin's files copied to the channel's home, when the person wants them; the manifest's path, or null. */
  async #placePlugin(): Promise<string | null> {
    const from = this.#copy.packaged();
    const home = this.#settings.pluginHome;

    if (from === null) {
      this.#prompts.log.warn(SETUP_TEXT.noPlugin);

      return null;
    }

    if (!this.#answered(await this.#prompts.confirm({ message: SETUP_TEXT.placePlugin(home), initialValue: true }))) {
      return null;
    }

    try {
      const manifest = await this.#copy.install(from, home);

      this.#prompts.log.success(SETUP_TEXT.placed(home));

      return manifest;
    } catch (error) {
      this.#prompts.log.error(this.#message(error));

      return null;
    }
  }

  async #confirm(message: string): Promise<boolean> {
    return this.#answered(await this.#prompts.confirm({ message }));
  }

  /** A question's answer, or SetupCancelled when the person backed out (Ctrl+C, Esc). */
  #answered<Answer>(value: Answer | symbol): Answer {
    if (this.#prompts.isCancel(value)) {
      throw new SetupCancelled();
    }

    return value;
  }

  #message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
