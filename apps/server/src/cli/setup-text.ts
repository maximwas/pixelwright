import { join } from "node:path";
import { CODEX_CONFIG_PATH, CURSOR_CONFIG_PATH, SERVER_INVOCATION, SERVER_NAME } from "../constants/clients.ts";
import { clientConfigBlock, codexBlock } from "./clients.ts";

/** What `pixelwright setup --print` prints: each client's way in and the plugin's, for scripts and CI. */
export function setupText(manifest: string): string {
  const server = [SERVER_INVOCATION.command, ...SERVER_INVOCATION.args].join(" ");

  return [
    "Claude Code:",
    `  claude mcp add ${SERVER_NAME} --scope user -- ${server}`,
    "",
    `Cursor (~/${join(...CURSOR_CONFIG_PATH)}), or any client with an mcpServers config:`,
    clientConfigBlock(SERVER_INVOCATION),
    "",
    `Codex (~/${join(...CODEX_CONFIG_PATH)}):`,
    codexBlock(SERVER_INVOCATION),
    "",
    "Figma plugin, in Figma Desktop:",
    `  Plugins → Development → Import plugin from manifest… → ${manifest}`,
    "  Then open your file, run Plugins → Development → Pixelwright and keep its window open.",
    "",
  ].join("\n");
}
