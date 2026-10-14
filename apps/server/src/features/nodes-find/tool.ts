import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { NodesFindInputSchema, NodesFindOutputSchema } from "./schemas.ts";

export function nodesFindTool({
  plugin,
}: ToolContext): ToolDefinition<typeof NodesFindInputSchema, typeof NodesFindOutputSchema> {
  return {
    name: "nodes_find",
    title: "Find layers",
    description:
      "Finds layers on the current page, or inside `within`, by name (substring), type (FRAME, TEXT, INSTANCE…), text content (substring) or component (an instance's component or component set name). Returns ids, names, types, boxes and the names of their ancestors, at most `limit` (more: true when there were more). Combine criteria to narrow down.",
    input: NodesFindInputSchema,
    output: NodesFindOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...query }) => plugin.run("find", query, file),
  };
}
