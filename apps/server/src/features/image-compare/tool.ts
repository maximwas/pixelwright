import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { compareImage } from "./compare-image.ts";
import { ImageCompareInputSchema, ImageCompareOutputSchema } from "./schemas.ts";

export function imageCompareTool({
  plugin,
}: ToolContext): ToolDefinition<typeof ImageCompareInputSchema, typeof ImageCompareOutputSchema> {
  return {
    name: "image_compare",
    title: "Compare a layer with an image or a layer",
    description:
      "Renders a layer as screenshot does (scale, effects and clip alike) and compares it with a PNG on disk, typically a screenshot of your build at the same size, or with another layer (against) rendered the same way, a variant against its default or a rebuilt frame against the original: rmse (0 to 255) and the share of differing pixels over the part both cover, the box around the differences, and the edges: each horizontal (rows, by y) and vertical (columns, by x) edge of the reference matched, shifted by a few px (by: how far the render's is off), missing, or extra in the render. diff writes a PNG of the difference. Take the reference at the render's density (scale 2 for a 2x screenshot). Works while Allow edits is off.",
    input: ImageCompareInputSchema,
    output: ImageCompareOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => compareImage(plugin, args),
  };
}
