import { CloseCode } from "@pixelwright/core";
import type { HintInput } from "../types/bridge.ts";

/** What the user should do, for status; null when a file is connected and nothing is wrong. */
export function bridgeHint({ state, connectedFiles, pairing, rejection, port, now }: HintInput): string | null {
  switch (state.kind) {
    case "disabled":
      return "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.";
    case "failed":
      return `The plugin bridge could not start: ${state.reason}`;
    case "unavailable":
      return state.closeCode === CloseCode.VersionMismatch
        ? `Another MCP client session runs another Pixelwright version and holds port ${port}: run the same version in both, or close that session. This one keeps retrying.`
        : `Port ${port} is held by a program that is not Pixelwright: free it. This session keeps retrying.`;
    case "owner":
    case "peer":
      break;
  }

  if (pairing !== null) {
    const seconds = Math.max(0, Math.ceil((pairing.expiresAt - now) / 1000));

    return `A Figma file is waiting to be paired: ask the user to type ${pairing.code} into the Pixelwright window in Figma (valid for ${seconds} s). Only the user types it; never type or send it anywhere yourself.`;
  }

  if (connectedFiles > 0) {
    return null;
  }

  if (rejection !== null) {
    return `A connection from origin ${rejection.origin ?? "(none)"} was refused (${rejection.reason}): if it was not the Pixelwright plugin, ignore it.`;
  }

  return "No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → Pixelwright, and keep the plugin window open.";
}
