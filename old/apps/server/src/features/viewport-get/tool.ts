import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { ViewportGetInputSchema, ViewportGetOutputSchema } from "./schemas.ts";

export function viewportGetTool({
  plugin,
}: ToolContext): ToolDefinition<typeof ViewportGetInputSchema, typeof ViewportGetOutputSchema> {
  return {
    name: "viewport_get",
    title: "What the user sees",
    description:
      'What the user is looking at in Figma now: the page, the zoom, the part of the page in view (page px), and the page\'s layers and their children that meet it, outermost first. Use it when the user says "this" or "here" without selecting anything; selection_get gives what is selected.',
    input: ViewportGetInputSchema,
    output: ViewportGetOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file }) => plugin.run("viewport", null, file),
  };
}
