import { parseArgs } from "node:util";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  CLI_OPTIONS,
  CLI_TEXT,
  COMMAND,
  COMMAND_LINE_WORD,
  COMMAND_LINES,
  EXIT_CODE,
} from "@/cli/main/cli.constants.ts";
import { CLI_COMMANDS, CLI_STREAMS } from "@/cli/main/cli.tokens.ts";
import type { CommandName } from "@/cli/main/cli.types.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/**
 * The command line (S-060): parseArgs reads the arguments and the command they name runs. With none, a person at a
 * terminal (stdin and stdout) gets the setup and an MCP client the server; `setup` with nobody there prints instead of
 * asking. The version, the help and an unknown command (exit 2, the help on stderr) need no command of their own.
 */
@injectable()
export class CommandLine {
  readonly #commands;
  readonly #streams;

  constructor(commands = inject(CLI_COMMANDS, { multi: true }), streams = inject(CLI_STREAMS)) {
    this.#commands = commands;
    this.#streams = streams;
  }

  /** Runs what the arguments name; resolves with the exit code. */
  async run(args: readonly string[]): Promise<number> {
    const name = this.parse(args);
    const command = this.#commands.find((candidate) => candidate.name === name);

    if (command !== undefined) {
      return command.run();
    }

    if (name === COMMAND.version || name === COMMAND.help) {
      this.#streams.stdout.write(name === COMMAND.version ? CLI_TEXT.version(VERSION) : CLI_TEXT.help);

      return EXIT_CODE.ok;
    }

    this.#streams.stderr.write(CLI_TEXT.unknown(args.join(COMMAND_LINE_WORD.separator), CLI_TEXT.help));

    return EXIT_CODE.unknown;
  }

  /** The command the arguments name. */
  parse(args: readonly string[]): CommandName {
    const line = this.#line(args);
    const interactive = (this.#streams.stdin.isTTY ?? false) && (this.#streams.stdout.isTTY ?? false);

    if (line === "") {
      return interactive ? COMMAND.setup : COMMAND.serve;
    }

    if (line === COMMAND.setup) {
      return interactive ? COMMAND.setup : COMMAND.setupPrint;
    }

    return (line === null ? undefined : COMMAND_LINES[line]) ?? COMMAND.unknown;
  }

  /** The words, then the options sorted, as one line (`-v` reads as --version); null for an option it does not know. */
  #line(args: readonly string[]): string | null {
    try {
      const { values, positionals } = parseArgs({ args: [...args], options: CLI_OPTIONS, allowPositionals: true });
      const options = Object.keys(values)
        .sort()
        .map((name) => COMMAND_LINE_WORD.option(name));

      return [...positionals, ...options].join(COMMAND_LINE_WORD.separator);
    } catch {
      return null;
    }
  }
}

export const COMMAND_LINE = new InjectionToken<CommandLine>("CommandLine");
