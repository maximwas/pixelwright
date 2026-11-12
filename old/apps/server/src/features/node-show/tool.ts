import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { NodeShowInputSchema, NodeShowOutputSchema } from "./schemas.ts";

export function nodeShowTool({
  plugin,
}: ToolContext): ToolDefinition<typeof NodeShowInputSchema, typeof NodeShowOutputSchema> {
  return {
    name: "node_show",
    title: "Show layers",
    description:
      "Brings layers into view in Figma (switching to their page when needed) and selects them, so the user sees what you mean: one layer, or several on one page, fitted in view or at a zoom (1 is 100%) centred on them; select: false only moves the view. Changes only the view and the selection, never the file.",
    input: NodeShowInputSchema,
    output: NodeShowOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...show }) => plugin.run("show", show, file),
  };
}
