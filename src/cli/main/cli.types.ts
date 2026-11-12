import type { COMMAND } from "@/cli/main/cli.constants.ts";
import type { SetupSettings } from "@/cli/setup/setup.types.ts";

/** One command of the binary (Command pattern, A§4.2): CommandLine runs the one the arguments name. */
export interface CliCommand {
  readonly name: CommandName;
  /** Resolves with the exit code. */
  run(): Promise<number>;
}

export type CommandName = (typeof COMMAND)[keyof typeof COMMAND];

/** The process's streams: whether a person sits at them, and where the words go. */
export interface CliStreams {
  readonly stdin: { readonly isTTY?: boolean };
  readonly stdout: CliWriter;
  readonly stderr: CliWriter;
}

interface CliWriter {
  readonly isTTY?: boolean;
  write(text: string): unknown;
}

/** The shared log `logs` follows. */
export interface LogsSettings {
  readonly file: string;
}

/** What the root reads once for the commands. */
export interface CliSettings {
  readonly setup: SetupSettings;
  readonly logs: LogsSettings;
}
