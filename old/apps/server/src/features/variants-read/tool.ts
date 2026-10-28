import { VariantsViewSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readVariants } from "./read-variants.ts";
import { VariantsInputSchema } from "./schemas.ts";

export function variantsReadTool({
  plugin,
}: ToolContext): ToolDefinition<typeof VariantsInputSchema, typeof VariantsViewSchema> {
  return {
    name: "variants_read",
    title: "Read a component's states",
    description:
      "How each variant of a component set differs from its default one (the top-left, as Figma takes it), as nodes_diff says it: the attributes each changes as [the default's, this one's], the layers only one has, its properties, and the CSS pseudo-class a state value suggests (Hover → :hover, Pressed → :active, Focused → :focus-visible, Disabled → :disabled). Give the set, a variant or an instance. Build the default, then each state as its difference.",
    input: VariantsInputSchema,
    output: VariantsViewSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readVariants(plugin, args),
  };
}
