import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/**
 * The window (P-001): small and out of the way, open the whole time the plugin works, tall enough for the pairing field
 * and the longest stop reason; Figma's theme colours, so it matches light and dark.
 */
export const PLUGIN_WINDOW = { width: 280, height: 260, title: CHANNEL.pluginName, themeColors: true } as const;

/** The manifest facts both channels share, 0.7.0's (P-060, D-54, D-13: no enablePrivatePluginApi). */
export const FIGMA_MANIFEST = {
  api: "1.0.0",
  /** Design files and Dev Mode. */
  editorType: ["figma", "dev"],
  /** The Dev Mode inspect panel. */
  capabilities: ["inspect"],
  /** Async everything, pages load on demand. */
  documentAccess: "dynamic-page",
  /** The enabled libraries' catalogue. */
  permissions: ["teamlibrary"],
  reasoning: "Connects to the Pixelwright MCP server running on this computer.",
} as const;

/** The built plugin in dist/plugin, where pnpm plugin:install takes it from. */
export const PLUGIN_FILES = { manifest: "manifest.json", main: "main.js", ui: "ui.html" } as const;
