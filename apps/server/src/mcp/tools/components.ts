import type { McpServer } from "@modelcontextprotocol/server";
import { OPERATION_SCHEMAS, VariantsViewSchema } from "@pixelwright/core";
import * as z from "zod";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { readVariants } from "../../design/read-variants.ts";
import { FileSchema, VariantsInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

export function registerComponentsTool(server: McpServer, { bridge }: ToolContext): void {
  const { shape } = OPERATION_SCHEMAS.components.input;

  registerTool(server, {
    name: "components_read",
    title: "Read the components",
    description:
      "Lists components: scope used (default) gives the ones the instances on the current page, or inside `within`, come from (a library's among them, with how many instances use each); scope local gives every component defined in the file. Each comes with its key, variants (a set lists its variant names, \"Size=Large, State=Default\"), properties with their type, default and options, and description. Use it to map Figma components to the project's code components; design_read writes instances with component, variant and props.",
    input: z.object({
      scope: shape.scope.describe("used: what the page (or within) uses; local: what the file defines."),
      within: shape.within.describe(
        "A layer or page id to look in. Default: the current page (used) or every page (local).",
      ),
      query: shape.query.describe("Only components whose name contains this."),
      limit: shape.limit,
      file: FileSchema,
    }),
    output: OPERATION_SCHEMAS.components.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...query }) => runOp(bridge, "components", query, file),
  });
}

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
