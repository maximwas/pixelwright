import { BridgeError, type MeasureSchema, measureLayers } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import type { MeasureInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

type MeasureArgs = z.output<typeof MeasureInputSchema>;

/** The layers named (else the selection), read by the inspect op in page px, measured by core. */
export async function measureNodes(
  bridge: ToolContext["bridge"],
  { nodes, painted, file }: MeasureArgs,
): Promise<z.output<typeof MeasureSchema>> {
  const ids = nodes ?? (await runOp(bridge, "selection", null, file)).nodes.map((node) => node.id);
  const raw = await runOp(bridge, "inspect", { nodes: ids.slice(0, 100) }, file);

  if (raw.layers.length < 2) {
    throw new BridgeError(
      "OP_FAILED",
      `Measuring takes two layers or more: ${raw.layers.length === 0 ? "none" : "only one"} of ${ids.join(", ") || "the selection"} ${raw.layers.length === 1 ? "is a layer" : "are layers"} of this file.`,
    );
  }

  return {
    measured: painted ? "painted" : "box",
    ...measureLayers(raw.layers, painted),
    missing: raw.missing,
  };
}
