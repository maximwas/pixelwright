import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readOutline } from "./read-outline.ts";
import { OutlineInputSchema, OutlineOutputSchema } from "./schemas.ts";

export function outlineTool({
  plugin,
}: ToolContext): ToolDefinition<typeof OutlineInputSchema, typeof OutlineOutputSchema> {
  return {
    name: "outline",
    title: "Outline a frame",
    description:
      'The layer tree of a frame, a page or the current page, as light XML: tag (the Figma type), id, name and box (x and y relative to the outlined node) per layer, to `depth` levels; an instance also names its component and variant, so repeated components show. Use it to find the sections of a big frame before reading one with design_read. A layer with `$children="N"` has N children not listed here: outline it on its own.',
    input: OutlineInputSchema,
    output: OutlineOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readOutline(plugin, args),
  };
}
