import type { McpServer } from "@modelcontextprotocol/server";
import { countOutline, OPERATION_SCHEMAS, outlineXml } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

const READ_ONLY = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function registerNodeTools(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "selection_get",
    title: "Read the selection",
    description:
      'Lists the layers the user selected in Figma (id, name, type, box in page coordinates). Call it when the user says "this", "the selected one" or "what I picked", then read those ids with design_read or outline.',
    input: z.object({ file: FileSchema }),
    output: OPERATION_SCHEMAS.selection.output,
    annotations: READ_ONLY,
    run: ({ file }) => runOp(bridge, "selection", null, file),
  });
  registerTool(server, {
    name: "node_show",
    title: "Show a node",
    description:
      "Selects a layer in Figma and brings it into view (switching to its page when needed), so the user sees what you mean. Changes only the view and the selection, never the file.",
    input: z.object({
      node: OPERATION_SCHEMAS.show.input.shape.node.describe("The layer's id, e.g. 2:4868."),
      file: FileSchema,
    }),
    output: OPERATION_SCHEMAS.show.output,
    annotations: READ_ONLY,
    run: ({ file, node }) => runOp(bridge, "show", { node }, file),
  });
  registerTool(server, {
    name: "nodes_find",
    title: "Find layers",
    description:
      "Finds layers on the current page, or inside `within`, by name (substring), type (FRAME, TEXT, INSTANCE…), text content (substring) or component (an instance's component or component set name). Returns ids, names, types, boxes and the names of their ancestors, at most `limit` (more: true when there were more). Combine criteria to narrow down.",
    input: OPERATION_SCHEMAS.find.input.extend({ file: FileSchema }),
    output: OPERATION_SCHEMAS.find.output,
    annotations: READ_ONLY,
    run: ({ file, ...query }) => runOp(bridge, "find", query, file),
  });
  registerTool(server, {
    name: "outline",
    title: "Outline a frame",
    description:
      'The layer tree of a frame, a page or the current page, as light XML: tag (the Figma type), id, name and box (x and y relative to the outlined node) per layer, to `depth` levels. Use it to find the sections of a big frame before reading one with design_read. A layer with `$children="N"` has N children not listed here: outline it on its own.',
    input: z.object({
      node: OPERATION_SCHEMAS.outline.input.shape.node.describe(
        "The layer or page id, or 0:0 for the list of pages. Default: the current page.",
      ),
      depth: OPERATION_SCHEMAS.outline.input.shape.depth.describe("How many levels below the node to list (1 to 10)."),
      file: FileSchema,
    }),
    output: z.object({
      xml: z.string(),
      nodes: z.number().describe("How many layers the XML lists."),
    }),
    annotations: READ_ONLY,
    run: async ({ file, ...query }) => {
      const { root } = await runOp(bridge, "outline", query, file);

      return {
        xml: outlineXml(root),
        nodes: countOutline(root),
      };
    },
  });
}
