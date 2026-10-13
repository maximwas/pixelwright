import type { McpServer } from "@modelcontextprotocol/server";
import { BridgeError, MeasureSchema, measureLayers } from "@pixelwright/core";
import type * as z from "zod";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { MeasureInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

type MeasureArgs = z.output<typeof MeasureInputSchema>;

export function registerMeasureTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "measure",
    title: "Measure between layers",
    description:
      "Measures the distances between layers, each from the one before it in the list (a→b, b→c, so a row's rhythm shows): the gap between their boxes on each axis (negative where they overlap), how their edges and centres line up (B's minus A's: 0 is aligned), and, when one holds the other, how far it sits from each edge, as padding. Layout boxes by default; painted: true measures what is painted (strokes, shadows). A sentence per pair says it plainly. Works while Allow edits is off.",
    input: MeasureInputSchema,
    output: MeasureSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => measureNodes(bridge, args),
  });
}

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
