import type { McpServer } from "@modelcontextprotocol/server";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { diffNodes } from "../../design/diff-nodes.ts";
import { NodesDiffInputSchema, NodesDiffOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerDiffTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "nodes_diff",
    title: "Compare two layers",
    description:
      "Compares two layers (A/B variants of a screen, a card and its copy) as design_read reads them: layers are matched by their path of names below each root (same-named siblings in order), and the answer lists the layers only A or only B has, and for each layer both have, the attributes that differ as [A's, B's] (text as $text, an instance's variant and props too) and whether an icon's or image's own drawing differs (paths, colours, inner layers). Ids and the two roots' own names and places are left out. Works while Allow edits is off.",
    input: NodesDiffInputSchema,
    output: NodesDiffOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => diffNodes(bridge, args),
  });
}
