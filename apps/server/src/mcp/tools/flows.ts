import type { McpServer } from "@modelcontextprotocol/server";
import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { FileSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

export function registerFlowsTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "flow_read",
    title: "Map the prototype",
    description:
      "A page's prototype as a map, for an app's routes: where its flows start, its screens (the page's frames, and those in its sections) with their sizes, and every interaction that leaves its layer: from which screen and layer, on what trigger, to which screen (or back, close, a URL), and how it moves (\"navigate to Detail; smart animate 300ms ease-out\"). A variant switch stays inside its component and is read by design_read as $on-*.",
    input: z.object({
      page: OPERATION_SCHEMAS.flows.input.shape.page.describe("The page's id. Default: the current page."),
      file: FileSchema,
    }),
    output: OPERATION_SCHEMAS.flows.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...flows }) => runOp(bridge, "flows", flows, file),
  });
}
