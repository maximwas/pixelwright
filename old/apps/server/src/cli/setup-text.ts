import { join } from "node:path";
import { CODEX_CONFIG_PATH, CURSOR_CONFIG_PATH, SERVER_INVOCATION, SERVER_NAME } from "../constants/clients.ts";
import { claudeCodeInvocation } from "../utils/server-invocation.ts";
import { clientConfigBlock, codexBlock } from "./clients.ts";
import { installPlugin } from "./plugin-files.ts";

/**
 * What `pixelwright setup --print` prints: each client's way in and the plugin's, for scripts and CI. `manifest` is
 * where the plugin was put, or null when this copy of Pixelwright has none.
 */
export function setupText({ manifest, platform }: { manifest: string | null; platform: NodeJS.Platform }): string {
  const claudeCode = claudeCodeInvocation(SERVER_INVOCATION, platform);

  return [
    "Claude Code:",
    `  claude mcp add ${SERVER_NAME} --scope user -- ${[claudeCode.command, ...claudeCode.args].join(" ")}`,
    "",
    `Cursor (~/${join(...CURSOR_CONFIG_PATH)}), or any client with an mcpServers config:`,
    clientConfigBlock(SERVER_INVOCATION),
    "",
    `Codex (~/${join(...CODEX_CONFIG_PATH)}):`,
    codexBlock(SERVER_INVOCATION),
    "",
    ...(manifest === null
      ? [
          "Figma plugin: this copy of Pixelwright has none. Get it from npm with: npx -y pixelwright@latest setup --print",
        ]
      : [
          "Figma plugin, in Figma Desktop:",
          `  Plugins → Development → Import plugin from manifest… → ${manifest}`,
          "  Then open your file, run Plugins → Development → Pixelwright and keep its window open.",
        ]),
    "",
  ].join("\n");
}

/** `setup --print`: the plugin put where Figma Desktop imports it from first, so the path the text gives is there. */
export async function printSetup({
  from,
  pluginHome,
  platform,
}: {
  from: string | null;
  pluginHome: string;
  platform: NodeJS.Platform;
}): Promise<string> {
  return setupText({
    manifest: from === null ? null : await installPlugin(from, pluginHome),
    platform,
  });
}
