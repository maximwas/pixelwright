import { MAX_IMAGE_SIDE_PX } from "../../constants/mcp.ts";
import { takeScreenshot } from "../../images/screenshot.ts";
import type { ContentToolDefinition, ToolContext } from "../../types/mcp.ts";
import { ScreenshotInputSchema } from "./schemas.ts";

export function screenshotTool({ plugin }: ToolContext): ContentToolDefinition<typeof ScreenshotInputSchema> {
  return {
    name: "screenshot",
    title: "Screenshot a layer",
    description: `Renders a layer to PNG so you can see it: a section to build, or your result to check. Returned inline at most ${MAX_IMAGE_SIDE_PX} px on a side: a larger layer comes scaled down to fit, and the text says its full size. For details of a tall layer screenshot one section of it (outline lists them), or pass clip for a region of it; pass save to write the PNG full size to a file instead.`,
    input: ScreenshotInputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: ({ file, ...shot }) => takeScreenshot(plugin.session(file), shot),
  };
}
