import { ContrastSchema } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { checkContrast } from "./contrast-check.ts";
import { ContrastInputSchema } from "./schemas.ts";

export function contrastCheckTool({
  plugin,
}: ToolContext): ToolDefinition<typeof ContrastInputSchema, typeof ContrastSchema> {
  return {
    name: "contrast_check",
    title: "Check text contrast",
    description:
      "Rates every visible text under a layer for WCAG contrast against what is behind it (the layers below it that cover it, then its parents' fills up to the page, those above the layer named included, see-through ones laid over what is below; a see-through layer over the text, a scrim, laid over both): the ratio, whether it is large text (24 px, or 18.66 px bold), and whether it passes AA and AAA. Each run with a colour of its own has a row (a link in a sentence). A text over an image or a gradient, or over a layer that covers only part of it, is said, not guessed: check those in a screenshot; on a see-through panel (glass, its blur not weighed) the worst part under it is rated. Texts cut off by a clipping frame or hidden under an opaque layer are left out and counted. Works while Allow edits is off.",
    input: ContrastInputSchema,
    output: ContrastSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => checkContrast(plugin, args),
  };
}
