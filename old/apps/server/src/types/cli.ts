import type { SpawnSyncReturns } from "node:child_process";

/** What the command line asks for. */
export type CliCommand =
  | { kind: "mcp" }
  | { kind: "setup"; print: boolean }
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "logs" }
  | { kind: "unknown"; argument: string };

/** A command line: the program and its arguments. */
export interface Invocation {
  readonly command: string;
  readonly args: readonly string[];
}

/** An MCP client the setup wizard can connect. */
export type McpClient = "claude-code" | "cursor" | "codex" | "other";

/** Runs the `claude` command with these arguments and waits for it. */
export type ClaudeRun = (args: readonly string[]) => SpawnSyncReturns<string>;
