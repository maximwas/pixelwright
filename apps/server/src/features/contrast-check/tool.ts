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
      "Rates every visible text under a layer for WCAG contrast against what is behind it (the layers below it that cover it, then its parents' fills, see-through ones laid over what is below): the ratio, whether it is large text (24 px, or 18.66 px bold), and whether it passes AA and AAA. A text over an image or a gradient is said, not guessed: check those in a screenshot. Works while Allow edits is off.",
    input: ContrastInputSchema,
    output: ContrastSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => checkContrast(plugin, args),
  };
}
