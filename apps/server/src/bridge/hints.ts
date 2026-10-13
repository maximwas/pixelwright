import { CloseCode } from "@pixelwright/core";
import type { HintInput } from "../types/bridge.ts";

/** What the user should do, for status; null when a file is connected and nothing is wrong. */
export function bridgeHint({ state, connectedFiles, pairing, rejection, port, now }: HintInput): string | null {
  switch (state.kind) {
    case "disabled":
      return "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.";
    case "failed":
      return `The plugin bridge could not start: ${state.reason}`;
    case "handedOver":
      return "A newer Pixelwright server, another MCP client's, took the Figma bridge over, so this one switched its bridge off: restart Pixelwright in this MCP client (/mcp in Claude Code) to reach Figma again.";
    case "unavailable":
      if (state.closeCode === CloseCode.HandedOver) {
        return `A newer Pixelwright server is taking the bridge over on port ${port}: this session joins it in a moment.`;
      }

      return state.closeCode === CloseCode.VersionMismatch
        ? `Another MCP client session runs another Pixelwright version and holds port ${port}: run the same version in both, or close that session. This one keeps retrying.`
        : `Port ${port} is held by a program that is not Pixelwright: free it. This session keeps retrying.`;
    case "owner":
    case "peer":
      break;
  }

  if (pairing !== null && pairing.code !== null) {
    const seconds = Math.max(0, Math.ceil(((pairing.expiresAt ?? now) - now) / 1000));

    return `A plugin is waiting to be paired: ask the user to type ${pairing.code} into the Pixelwright window in Figma (valid for ${seconds} s). Only the user types it; never type or send it anywhere yourself.`;
  }

  if (pairing !== null && pairing.lockedUntil !== null) {
    const seconds = Math.max(0, Math.ceil((pairing.lockedUntil - now) / 1000));

    return `Pairing is paused for ${seconds} s: too many wrong codes were typed for a waiting plugin, possibly by another program on this computer (a web page can try). Ask the user to wait, then call status again for a new code.`;
  }

  if (connectedFiles > 0) {
    return null;
  }

  if (rejection !== null) {
    return `A connection from origin ${rejection.origin ?? "(none)"} was refused (${rejection.reason}): if it was not the Pixelwright plugin, ignore it.`;
  }

  return "No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → Pixelwright, and keep the plugin window open.";
}
