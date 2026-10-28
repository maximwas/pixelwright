import { injectable } from "@needle-di/core";
import type { PluginLink, PluginLinkState } from "../../../../core/ports/plugin-link/plugin-link.port.ts";
import { CHANNEL } from "../../../../shared/protocol/channel.constants.ts";

/** The link while the bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): no plugin reaches this server. */
@injectable()
export class NoBridge implements PluginLink {
  state(): PluginLinkState {
    return {
      role: "disabled",
      port: CHANNEL.port,
      hint: "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.",
    };
  }
}
