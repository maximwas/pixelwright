import { CloseCode } from "@pixelwright/core";
import type { BridgeState, UpgradeRejection } from "../types/bridge.ts";

/** What the user should do, for status; null when a file is connected and nothing is wrong. */
export function bridgeHint(
  state: BridgeState,
  connectedFiles: number,
  rejection: UpgradeRejection | null,
  port: number,
): string | null {
  switch (state.kind) {
    case "disabled":
      return "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.";
    case "failed":
      return `The plugin bridge could not start: ${state.reason}`;
    case "unavailable":
      return state.closeCode === CloseCode.VersionMismatch
        ? `Another Claude Code session runs another Pixelwright version and holds port ${port}: run the same version in both, or close that session. This one keeps retrying.`
        : `Port ${port} is held by a program that is not Pixelwright: free it. This session keeps retrying.`;
    case "owner":
    case "peer":
      break;
  }

  if (connectedFiles > 0) {
    return null;
  }

  if (rejection !== null) {
    return rejection.reason === "origin"
      ? `A plugin tried to connect from origin ${rejection.origin ?? "(none)"}, which the bridge does not accept. If it is the Pixelwright plugin, add that origin to PIXELWRIGHT_PLUGIN_ORIGINS and restart the MCP server.`
      : `A connection to the bridge was refused (${rejection.reason}).`;
  }

  return "No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → Pixelwright, and keep the plugin window open.";
}
