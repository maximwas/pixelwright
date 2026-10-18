import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { compareStyles } from "./compare-styles.ts";
import { StylesCompareInputSchema, StylesCompareOutputSchema } from "./schemas.ts";

export function stylesCompareTool({
  plugin,
}: ToolContext): ToolDefinition<typeof StylesCompareInputSchema, typeof StylesCompareOutputSchema> {
  return {
    name: "styles_compare",
    title: "Compare a build's styles with the design",
    description:
      "Whether a build has each style the design sets, property by property. Give pairs: a layer (design_read's id) and the computed styles of the element that draws it, as the browser gives them: Object.fromEntries([...getComputedStyle(el)].map((p) => [p, getComputedStyle(el).getPropertyValue(p)])), or only the properties a first call lists in notGiven. Each layer is read as design_read writes it in its parent, its tokens and text style in and its shorthands spread into longhands (padding into padding-top…, border into each side's width, style and colour, font into family, size, weight, style and line height, gap into row-gap and column-gap). mismatches gives each property the build has otherwise with both values and the token or text style it comes from; notGiven what the build's styles leave out; notCompared what a computed style cannot be held against (offsets in percent or calc(), fr tracks). Sizes and places may be off by tolerance px; other lengths, colours (hex or rgb()), shadows, gradients and transforms compare by value. What the design leaves unset is not checked. image_compare compares the pixels. Works while Allow edits is off.",
    input: StylesCompareInputSchema,
    output: StylesCompareOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => compareStyles(plugin, args),
  };
}
