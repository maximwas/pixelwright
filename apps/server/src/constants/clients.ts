import type { Invocation, McpClient } from "../types/cli.ts";

/** The name the server is registered under in every MCP client. */
export const SERVER_NAME = "pixelwright";

/** How MCP clients start the server: always the latest release from npm. */
export const SERVER_INVOCATION: Invocation = {
  command: "npx",
  args: ["-y", "pixelwright@latest"],
};

/** The clients the setup wizard offers, and how it names them. */
export const MCP_CLIENTS: readonly { readonly value: McpClient; readonly label: string }[] = [
  {
    value: "claude-code",
    label: "Claude Code",
  },
  {
    value: "cursor",
    label: "Cursor",
  },
  {
    value: "codex",
    label: "Codex",
  },
  {
    value: "other",
    label: "Another MCP client",
  },
];

/** Cursor's user-wide MCP config. */
export const CURSOR_CONFIG_PATH = [".cursor", "mcp.json"] as const;

/** Codex's config, where the wizard only shows what to add (TOML is edited by hand). */
export const CODEX_CONFIG_PATH = [".codex", "config.toml"] as const;

/** Codex gives a server 10 s to start by default; the first start through npx downloads the package first. */
export const CODEX_STARTUP_TIMEOUT_SEC = 60;

/** The name in the plugin's manifest: a folder whose manifest says so holds an older copy the setup may replace. */
export const PLUGIN_MANIFEST_NAME = "Pixelwright";
