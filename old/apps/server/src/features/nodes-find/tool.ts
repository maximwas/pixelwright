import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { findNodes } from "./find-nodes.ts";
import { NodesFindInputSchema, NodesFindOutputSchema } from "./schemas.ts";

export function nodesFindTool({
  plugin,
}: ToolContext): ToolDefinition<typeof NodesFindInputSchema, typeof NodesFindOutputSchema> {
  return {
    name: "nodes_find",
    title: "Find layers",
    description:
      'Finds layers on the current page, or inside `within` (a layer, a page, or "file" for every page), by name (substring), type (FRAME, TEXT, INSTANCE…), text content (substring), component (an instance\'s component or component set name) or variant (an instance\'s variant values, "State=Hover, Size=L"). Returns ids, names, types, boxes and the names of their ancestors, at most `limit` (more: true when there were more). Combine criteria to narrow down. counts: true also counts every instance found, past the limit, by component and variant: before deleting variants, which ones layers still use, without code.',
    input: NodesFindInputSchema,
    output: NodesFindOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => findNodes(plugin, args),
  };
}
