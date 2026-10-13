import { BridgeError } from "@pixelwright/core";
import type { ToolContext } from "../types/mcp.ts";
import { runOp } from "./run-op.ts";

/** The one layer selected in Figma, for a tool whose node defaults to it; an error naming what to do otherwise. */
export async function selectedLayer(bridge: ToolContext["bridge"], file: string | undefined): Promise<string> {
  const { nodes } = await runOp(bridge, "selection", null, file);

  if (nodes.length !== 1 || nodes[0] === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      `${nodes.length === 0 ? "Nothing is" : `${nodes.length} layers are`} selected in Figma: select one layer (a section, a screen), or give its id in node.`,
    );
  }

  return nodes[0].id;
}
