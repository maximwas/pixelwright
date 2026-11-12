import { BridgeError } from "@pixelwright/core";
import type { PluginSession } from "./plugin-session.ts";

/**
 * The one layer selected in Figma, for a tool whose node defaults to it; an error naming what to do otherwise, with the
 * code the tool has always answered with (OP_FAILED for the read checks, NODE_NOT_FOUND for the baseline tools).
 */
export async function selectedLayer(
  session: PluginSession,
  code: "OP_FAILED" | "NODE_NOT_FOUND" = "OP_FAILED",
): Promise<string> {
  const { nodes } = await session.run("selection", null);

  if (nodes.length !== 1 || nodes[0] === undefined) {
    throw new BridgeError(
      code,
      `${nodes.length === 0 ? "Nothing is" : `${nodes.length} layers are`} selected in Figma: select one layer (a section, a screen), or give its id in node.`,
    );
  }

  return nodes[0].id;
}
