import type { McpServer } from "@modelcontextprotocol/server";
import { VariantsViewSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { readVariants } from "../../design/read-variants.ts";
import { VariantsInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerVariantsTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "variants_read",
    title: "Read a component's states",
    description:
      "How each variant of a component set differs from its default one (the top-left, as Figma takes it), as nodes_diff says it: the attributes each changes as [the default's, this one's], the layers only one has, its properties, and the CSS pseudo-class a state value suggests (Hover → :hover, Pressed → :active, Focused → :focus-visible, Disabled → :disabled). Give the set, a variant or an instance. Build the default, then each state as its difference.",
    input: VariantsInputSchema,
    output: VariantsViewSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readVariants(bridge, args),
  });
}
