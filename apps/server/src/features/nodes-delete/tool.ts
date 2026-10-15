import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { NodesDeleteInputSchema, NodesDeleteOutputSchema } from "./schemas.ts";

export function nodesDeleteTool({
  plugin,
}: ToolContext): ToolDefinition<typeof NodesDeleteInputSchema, typeof NodesDeleteOutputSchema> {
  return {
    name: "nodes_delete",
    title: "Delete layers",
    description:
      'Deletes layers by id, each on its own: one Figma will not delete (a layer inside an instance, which comes from its component: hide it with display="none" in design_apply instead) stays, with why. One call is one undo step in Figma. Refused while the plugin\'s Allow edits switch is off.',
    input: NodesDeleteInputSchema,
    output: NodesDeleteOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: ({ file, nodes }) => plugin.run("delete", { nodes }, file),
    changed: ({ deleted }) => deleted.length > 0,
  };
}
