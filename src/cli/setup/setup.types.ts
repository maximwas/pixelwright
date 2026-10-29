import type { ConfirmOptions, MultiSelectOptions } from "@clack/prompts";
import type { MCP_CLIENT } from "@/cli/setup/setup.constants.ts";

export type McpClient = (typeof MCP_CLIENT)[keyof typeof MCP_CLIENT];

/** How an MCP client starts the server: a command and its arguments, never a shell line. */
export interface Invocation {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * Where the setup works: the user's home (Cursor's and Codex's configs), the channel's plugin folder, the platform
 * (Windows wraps npx for Claude Code) and how clients start the server.
 */
export interface SetupSettings {
  readonly userHome: string;
  readonly pluginHome: string;
  readonly platform: NodeJS.Platform;
  readonly invocation: Invocation;
}

/** The plugin's files: where this package keeps them (null without a built one), and their copy (the manifest's path). */
export interface PluginFiles {
  packaged(): string | null;
  install(from: string, to: string): Promise<string>;
}

/** @clack/prompts as the wizard uses it, so a test hands it recorders instead of a terminal. */
export interface Prompts {
  intro(title: string): void;
  outro(message: string): void;
  note(message: string, title: string): void;
  cancel(message: string): void;
  readonly log: { success(message: string): void; error(message: string): void; warn(message: string): void };
  spinner(): { start(message: string): void; stop(message: string): void; error(message: string): void };
  multiselect(options: MultiSelectOptions<McpClient>): Promise<McpClient[] | symbol>;
  confirm(options: ConfirmOptions): Promise<boolean | symbol>;
  isCancel(value: unknown): value is symbol;
}
