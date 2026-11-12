import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readComponents } from "./read-components.ts";
import { ComponentsReadInputSchema, ComponentsReadOutputSchema } from "./schemas.ts";

export function componentsReadTool({
  plugin,
  project,
}: ToolContext): ToolDefinition<typeof ComponentsReadInputSchema, typeof ComponentsReadOutputSchema> {
  return {
    name: "components_read",
    title: "Read the components",
    description:
      'Lists components: scope used (default) gives the ones the instances on the current page, or inside `within`, come from (a library\'s among them, with how many instances use each); scope local gives every component defined in the file. Each comes with its key, variants, properties (type, default, options), description, `exposed` (the nested instances whose properties its instances show: in code they are its props too) and `code`: the project\'s Code Connect template or batch row that connects it ({component, source, template, by}), or null. `mapped: false` lists only the components without code yet: connect each with a batch row keyed by its key (guide topic code-connect). `links: true` also reads the links people attached to it in Dev Mode (code, stories, docs), on Figma plans that keep them. A big section lists long: `fields` keeps only the ones named, so scope local with query "icon/" and fields ["name"] lists the icon sets by name.',
    input: ComponentsReadInputSchema,
    output: ComponentsReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: async (input) => readComponents(plugin, input, await project.root()),
  };
}
