import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { replaceTexts } from "./replace-texts.ts";
import { TextsReplaceInputSchema, TextsReplaceOutputSchema } from "./schemas.ts";

export function textsReplaceTool({
  plugin,
}: ToolContext): ToolDefinition<typeof TextsReplaceInputSchema, typeof TextsReplaceOutputSchema> {
  return {
    name: "texts_replace",
    title: "Find and replace text",
    description:
      "Finds and replaces text in every text under a layer, a page or the file: one pair or a list (copy edits, a translation dictionary), plain or a regular expression with groups, any case unless caseSensitive, whole words when asked. Each match is replaced where it stands, so its run keeps its font, colour and link; a text an instance shows from a component text property changes through the property. Answers each changed text before and after; a text whose font is missing is named and left. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun lists without writing).",
    input: TextsReplaceInputSchema,
    output: TextsReplaceOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => replaceTexts(plugin, args),
    changed: ({ dryRun, texts }) => !dryRun && texts > 0,
  };
}
