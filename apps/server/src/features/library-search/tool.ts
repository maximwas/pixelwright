import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { librariesFolder } from "./library-store.ts";
import { LibrarySearchInputSchema, LibrarySearchOutputSchema } from "./schemas.ts";
import { searchLibraries } from "./search-libraries.ts";

export function librarySearchTool({
  plugin,
}: ToolContext): ToolDefinition<typeof LibrarySearchInputSchema, typeof LibrarySearchOutputSchema> {
  return {
    name: "library_search",
    title: "Search the saved component libraries",
    description:
      'Finds components in the team\'s libraries, which the Plugin API cannot list from another file. First, in each library file (open in Figma Desktop with the Pixelwright plugin), call save: true: its own published components (keys, variants, properties, descriptions) are saved on this computer in ~/.pixelwright/libraries; save again after the library changes. Then query from any file: every word must appear in a component\'s name, description, page or variant values, in any order, and a typo still finds. Each result gives component (key:<key>) and properties: insert it with design_apply <Instance component="key:…" variant="State=Hover" props="Label=Buy"/>, which works once the library is published. Without query, lists the saved libraries with when each was saved. Writes nothing to Figma, so it works while Allow edits is off.',
    input: LibrarySearchInputSchema,
    output: LibrarySearchOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => searchLibraries(plugin, args, librariesFolder()),
  };
}
