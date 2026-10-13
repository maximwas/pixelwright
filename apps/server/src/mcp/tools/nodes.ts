import type { McpServer } from "@modelcontextprotocol/server";
import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { READ_ONLY_ANNOTATIONS, WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import { readOutline } from "../../layers/read-outline.ts";
import { FileSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

export function registerNodeTools(server: McpServer, { bridge, support }: ToolContext): void {
  registerTool(server, {
    name: "selection_get",
    title: "Read the selection",
    description:
      'Lists the layers the user selected in Figma (id, name, type, box in page coordinates). Call it when the user says "this", "the selected one" or "what I picked", then read those ids with design_read or outline.',
    input: z.object({ file: FileSchema }),
    output: OPERATION_SCHEMAS.selection.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file }) => runOp(bridge, "selection", null, file),
  });
  registerTool(server, {
    name: "node_show",
    title: "Show layers",
    description:
      "Brings layers into view in Figma (switching to their page when needed) and selects them, so the user sees what you mean: one layer, or several on one page, fitted in view or at a zoom (1 is 100%) centred on them; select: false only moves the view. Changes only the view and the selection, never the file.",
    input: z.object({
      node: OPERATION_SCHEMAS.show.input.shape.node.describe("The layer's id, e.g. 2:4868. Give node or nodes."),
      nodes: OPERATION_SCHEMAS.show.input.shape.nodes.describe("Several layers on one page, fitted in view together."),
      zoom: OPERATION_SCHEMAS.show.input.shape.zoom.describe('"fit" (default), or a zoom: 1 is 100%, 0.5 is 50%.'),
      select: OPERATION_SCHEMAS.show.input.shape.select.describe(
        "Select them too (default), or only bring them into view.",
      ),
      file: FileSchema,
    }),
    output: OPERATION_SCHEMAS.show.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...show }) => runOp(bridge, "show", show, file),
  });
  registerTool(server, {
    name: "viewport_get",
    title: "What the user sees",
    description:
      'What the user is looking at in Figma now: the page, the zoom, the part of the page in view (page px), and the page\'s layers and their children that meet it, outermost first. Use it when the user says "this" or "here" without selecting anything; selection_get gives what is selected.',
    input: z.object({ file: FileSchema }),
    output: OPERATION_SCHEMAS.viewport.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file }) => runOp(bridge, "viewport", null, file),
  });
  registerTool(server, {
    name: "nodes_find",
    title: "Find layers",
    description:
      "Finds layers on the current page, or inside `within`, by name (substring), type (FRAME, TEXT, INSTANCE…), text content (substring) or component (an instance's component or component set name). Returns ids, names, types, boxes and the names of their ancestors, at most `limit` (more: true when there were more). Combine criteria to narrow down.",
    input: OPERATION_SCHEMAS.find.input.extend({ file: FileSchema }),
    output: OPERATION_SCHEMAS.find.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...query }) => runOp(bridge, "find", query, file),
  });
  registerTool(server, {
    name: "outline",
    title: "Outline a frame",
    description:
      'The layer tree of a frame, a page or the current page, as light XML: tag (the Figma type), id, name and box (x and y relative to the outlined node) per layer, to `depth` levels; an instance also names its component and variant, so repeated components show. Use it to find the sections of a big frame before reading one with design_read. A layer with `$children="N"` has N children not listed here: outline it on its own.',
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
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readOutline(bridge, args),
  });
  registerTool(
    server,
    {
      name: "nodes_delete",
      title: "Delete layers",
      description:
        'Deletes layers by id, each on its own: one Figma will not delete (a layer inside an instance, which comes from its component: hide it with display="none" in design_apply instead) stays, with why. One call is one undo step in Figma. Refused while the plugin\'s Allow edits switch is off.',
      input: z.object({
        nodes: OPERATION_SCHEMAS.delete.input.shape.nodes.describe('The layers\' ids, e.g. ["2:4868"].'),
        file: FileSchema,
      }),
      output: OPERATION_SCHEMAS.delete.output,
      annotations: WRITE_ANNOTATIONS,
      run: ({ file, nodes }) => runOp(bridge, "delete", { nodes }, file),
      changed: ({ deleted }) => deleted.length > 0,
    },
    support,
  );
}
