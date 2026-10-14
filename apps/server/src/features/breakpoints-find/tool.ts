import { BreakpointsSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { findBreakpoints } from "./find-breakpoints.ts";
import { BreakpointsInputSchema } from "./schemas.ts";

export function breakpointsFindTool({
  plugin,
}: ToolContext): ToolDefinition<typeof BreakpointsInputSchema, typeof BreakpointsSchema> {
  return {
    name: "breakpoints_find",
    title: "Find a screen's other widths",
    description:
      "Finds the screen a layer is on at the page's other widths (Desktop, Tablet, Mobile): the page's frames, and those in its sections, whose names match once size words are left out (Desktop, Mobile, 1440, 375px) and whose children share names with it, narrowest first, each with a score. Compare them with nodes_diff to write the media queries.",
    input: BreakpointsInputSchema,
    output: BreakpointsSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => findBreakpoints(plugin, args),
  };
}
