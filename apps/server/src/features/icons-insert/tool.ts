import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { insertIcon } from "./insert-icon.ts";
import { IconsInsertInputSchema, IconsInsertOutputSchema } from "./schemas.ts";

export function iconsInsertTool({
  plugin,
}: ToolContext): ToolDefinition<typeof IconsInsertInputSchema, typeof IconsInsertOutputSchema> {
  return {
    name: "icons_insert",
    title: "Find and insert icons",
    description:
      "Icons from Iconify's open sets (Lucide, Material Symbols, Tabler, Phosphor, MDI and 150 more; no key). search lists icons as set:name with each set's licence, and writes nothing; icon inserts one as an Icon layer: drawn at size (its height in px) into parent, before a sibling, in a CSS colour or bound to a colour token (var(--token)), named after the icon. Sets drawn in their own colours (logos, flags) keep them. license names the set's licence: some ask for credit. Making the layer is one undo step in Figma, binding it to a token another; refused while the plugin's Allow edits switch is off (dryRun checks without writing). Needs the internet.",
    input: IconsInsertInputSchema,
    output: IconsInsertOutputSchema,
    annotations: {
      ...WRITE_ANNOTATIONS,
      openWorldHint: true,
    },
    run: (args) => insertIcon(plugin, args),
    changed: ({ created }) => created?.id !== undefined && created.id !== null,
  };
}
