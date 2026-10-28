import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { SelectionGetInputSchema, SelectionGetOutputSchema } from "./schemas.ts";

export function selectionGetTool({
  plugin,
}: ToolContext): ToolDefinition<typeof SelectionGetInputSchema, typeof SelectionGetOutputSchema> {
  return {
    name: "selection_get",
    title: "Read the selection",
    description:
      'Lists the layers the user selected in Figma (id, name, type, box in page coordinates). Call it when the user says "this", "the selected one" or "what I picked", then read those ids with design_read or outline.',
    input: SelectionGetInputSchema,
    output: SelectionGetOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file }) => plugin.run("selection", null, file),
  };
}
