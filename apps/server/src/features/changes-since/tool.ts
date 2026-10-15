import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { ChangesSinceInputSchema, ChangesSinceOutputSchema } from "./schemas.ts";

export function changesSinceTool({
  plugin,
}: ToolContext): ToolDefinition<typeof ChangesSinceInputSchema, typeof ChangesSinceOutputSchema> {
  return {
    name: "changes_since",
    title: "What changed",
    description:
      "What changed in the file since the plugin started watching (its window opened) or since an earlier answer's cursor: each layer created, deleted or changed (with the properties), by the user, a collaborator or Pixelwright itself, on the page the user was on. Ask with no cursor once to start, then with the cursor it gives, to read again only what the designer changed. Only pages the user had open while the plugin ran are watched; an edit made while one of Pixelwright's writes runs (or within a second after) counts as Pixelwright's, and changes from code execute left running count as the user's. What changed while the plugin was closed, and token values, baseline_diff tells against a saved baseline.",
    input: ChangesSinceInputSchema,
    output: ChangesSinceOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, cursor }) => plugin.run("changes", cursor === undefined ? {} : { since: cursor }, file),
  };
}
