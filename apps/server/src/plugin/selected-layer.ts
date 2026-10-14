import { BridgeError } from "@pixelwright/core";
import type { PluginSession } from "./plugin-session.ts";

/** The one layer selected in Figma, for a tool whose node defaults to it; an error naming what to do otherwise. */
export async function selectedLayer(session: PluginSession): Promise<string> {
  const { nodes } = await session.run("selection", null);

  if (nodes.length !== 1 || nodes[0] === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      `${nodes.length === 0 ? "Nothing is" : `${nodes.length} layers are`} selected in Figma: select one layer (a section, a screen), or give its id in node.`,
    );
  }

  return nodes[0].id;
}
