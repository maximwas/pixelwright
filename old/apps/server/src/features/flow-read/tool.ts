import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { FlowReadInputSchema, FlowReadOutputSchema } from "./schemas.ts";

export function flowReadTool({
  plugin,
}: ToolContext): ToolDefinition<typeof FlowReadInputSchema, typeof FlowReadOutputSchema> {
  return {
    name: "flow_read",
    title: "Map the prototype",
    description:
      "A page's prototype as a map, for an app's routes: where its flows start, its screens (the page's frames, and those in its sections) with their sizes, and every interaction that leaves its layer: from which screen and layer, on what trigger, to which screen (or back, close, a URL), and how it moves (\"navigate to Detail; smart animate 300ms ease-out\"). A variant switch stays inside its component and is read by design_read as $on-*.",
    input: FlowReadInputSchema,
    output: FlowReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...flows }) => plugin.run("flows", flows, file),
  };
}
