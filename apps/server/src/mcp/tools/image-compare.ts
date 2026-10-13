import type { McpServer } from "@modelcontextprotocol/server";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { compareImage } from "../../images/compare-image.ts";
import { ImageCompareInputSchema, ImageCompareOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerImageCompareTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "image_compare",
    title: "Compare a layer with an image",
    description:
      "Renders a layer as screenshot does (scale, effects and clip alike) and compares it with a PNG on disk, typically a screenshot of your build at the same size: rmse (0 to 255) and the share of differing pixels over the part both cover, the box around the differences, and the edges: each horizontal (rows, by y) and vertical (columns, by x) edge of the reference matched, shifted by a few px (by: how far the render's is off), missing, or extra in the render. diff writes a PNG of the difference. Take the reference at the render's density (scale 2 for a 2x screenshot). Works while Allow edits is off.",
    input: ImageCompareInputSchema,
    output: ImageCompareOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => compareImage(bridge, args),
  });
}
