import { FIGMA_MANIFEST, PLUGIN_FILES } from "@/plugin/main/plugin-manifest/plugin-manifest.constants.ts";
import type { Channel } from "@/shared/protocol/channel.constants.ts";
import { BRIDGE_URL_TEXT } from "@/shared/protocol/protocol.constants.ts";

/**
 * The Figma manifest of one channel (P-060, A§11.3), as manifest.json holds it, fields in 0.7.0's order. The channel
 * gives the name, the id and the one origin the window may reach, its bridge port; the build writes it.
 */
export class PluginManifest {
  readonly #channel: Channel;

  constructor(channel: Channel) {
    this.#channel = channel;
  }

  json() {
    return {
      api: FIGMA_MANIFEST.api,
      editorType: FIGMA_MANIFEST.editorType,
      id: this.#channel.pluginId,
      name: this.#channel.pluginName,
      main: PLUGIN_FILES.main,
      ui: PLUGIN_FILES.ui,
      capabilities: FIGMA_MANIFEST.capabilities,
      documentAccess: FIGMA_MANIFEST.documentAccess,
      permissions: FIGMA_MANIFEST.permissions,
      networkAccess: {
        allowedDomains: [BRIDGE_URL_TEXT.origin(this.#channel.port)],
        reasoning: FIGMA_MANIFEST.reasoning,
      },
    };
  }
}
