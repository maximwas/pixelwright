import { BridgeError } from "@pixelwright/core";

/** The text an MCP client shows for a failed call: the bridge's code first, so the model can act on it. */
export function describeError(error: unknown): string {
  if (error instanceof BridgeError) {
    return `${error.code}: ${error.message}`;
  }

  return error instanceof Error ? error.message : String(error);
}
