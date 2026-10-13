import { BridgeError, type Contrast, contrastCheck } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import type { ContrastInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The texts under a layer (the one selected when none is named) rated for contrast against what is behind them. */
export async function checkContrast(
  bridge: ToolContext["bridge"],
  { node, file }: z.output<typeof ContrastInputSchema>,
): Promise<Contrast> {
  const id = node ?? (await selectedLayer(bridge, file));

  return contrastCheck(
    await runOp(
      bridge,
      "snapshot",
      {
        node: id,
        css: "none",
      },
      file,
    ),
  );
}

async function selectedLayer(bridge: ToolContext["bridge"], file: string | undefined): Promise<string> {
  const { nodes } = await runOp(bridge, "selection", null, file);

  if (nodes.length !== 1 || nodes[0] === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      `${nodes.length === 0 ? "Nothing is" : `${nodes.length} layers are`} selected in Figma: select one layer (a section, a screen), or give its id in node.`,
    );
  }

  return nodes[0].id;
}
