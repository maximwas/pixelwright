/** What the command line asks for. */
export type CliCommand =
  | { kind: "mcp" }
  | { kind: "setup"; print: boolean }
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "unknown"; argument: string };

/** A command line: the program and its arguments. */
export interface Invocation {
  readonly command: string;
  readonly args: readonly string[];
}

/** An MCP client the setup wizard can connect. */
export type McpClient = "claude-code" | "cursor" | "codex" | "other";
