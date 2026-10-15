import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { checkFonts } from "./check-fonts.ts";
import { GoogleFontsCatalogue } from "./google-fonts.ts";
import { FontsCheckInputSchema, FontsCheckOutputSchema } from "./schemas.ts";

export function fontsCheckTool({
  plugin,
}: ToolContext): ToolDefinition<typeof FontsCheckInputSchema, typeof FontsCheckOutputSchema> {
  // Read once for the server: one catalogue for every call.
  const catalogue = new GoogleFontsCatalogue();

  return {
    name: "fonts_check",
    title: "Check the fonts",
    description:
      "The fonts a layer's texts use (the selected layer's by default), by family with the weights used, and where the build gets each: whether Google Fonts serves it, with a ready css2 link for those weights, and the weights it lacks; a family Google Fonts does not have needs its own files. Google Fonts' public catalogue is read once (no key); offline, the fonts are still listed.",
    input: FontsCheckInputSchema,
    output: FontsCheckOutputSchema,
    annotations: {
      ...READ_ONLY_ANNOTATIONS,
      openWorldHint: true,
    },
    run: (args) => checkFonts(plugin, args, () => catalogue.families()),
  };
}
