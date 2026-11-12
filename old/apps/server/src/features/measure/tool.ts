import { MeasureSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { measureNodes } from "./measure-layers.ts";
import { MeasureInputSchema } from "./schemas.ts";

export function measureTool({ plugin }: ToolContext): ToolDefinition<typeof MeasureInputSchema, typeof MeasureSchema> {
  return {
    name: "measure",
    title: "Measure between layers",
    description:
      "Measures the distances between layers, each from the one before it in the list (a→b, b→c, so a row's rhythm shows): the gap between their boxes on each axis (negative where they overlap), how their edges and centres line up (B's minus A's: 0 is aligned), and, when one holds the other, how far it sits from each edge, as padding. Layout boxes by default; painted: true measures what is painted (strokes, shadows). A sentence per pair says it plainly. Works while Allow edits is off.",
    input: MeasureInputSchema,
    output: MeasureSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => measureNodes(plugin, args),
  };
}
