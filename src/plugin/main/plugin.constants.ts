import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/**
 * The window (P-001): small and out of the way, open the whole time the plugin works, tall enough for the pairing field
 * and the longest stop reason; Figma's theme colours, so it matches light and dark.
 */
export const PLUGIN_WINDOW = {
  width: 280,
  height: 260,
  title: CHANNEL.pluginName,
  themeColors: true,
} as const;
