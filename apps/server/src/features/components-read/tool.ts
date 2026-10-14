import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { ComponentsReadInputSchema, ComponentsReadOutputSchema } from "./schemas.ts";

export function componentsReadTool({
  plugin,
}: ToolContext): ToolDefinition<typeof ComponentsReadInputSchema, typeof ComponentsReadOutputSchema> {
  return {
    name: "components_read",
    title: "Read the components",
    description:
      "Lists components: scope used (default) gives the ones the instances on the current page, or inside `within`, come from (a library's among them, with how many instances use each); scope local gives every component defined in the file. Each comes with its key, variants (a set lists its variant names, \"Size=Large, State=Default\"), properties with their type, default and options, and description. Use it to map Figma components to the project's code components; design_read writes instances with component, variant and props.",
    input: ComponentsReadInputSchema,
    output: ComponentsReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...query }) => plugin.run("components", query, file),
  };
}
