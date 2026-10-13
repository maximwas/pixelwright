import type { McpServer } from "@modelcontextprotocol/server";
import { MAX_IMAGE_SIDE_PX } from "../../constants/mcp.ts";
import { takeScreenshot } from "../../images/screenshot.ts";
import { ScreenshotInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerContentTool } from "../register-tool.ts";

/** No outputSchema on purpose: Claude Code would show the model only structuredContent and drop the image. */
export function registerScreenshotTool(server: McpServer, { bridge }: ToolContext): void {
  registerContentTool(server, {
    name: "screenshot",
    title: "Screenshot a layer",
    description: `Renders a layer to PNG so you can see it: a section to build, or your result to check. Returned inline at most ${MAX_IMAGE_SIDE_PX} px on a side: a larger layer comes scaled down to fit, and the text says its full size. For details of a tall layer screenshot one section of it (outline lists them), or pass clip for a region of it; pass save to write the PNG full size to a file instead.`,
    input: ScreenshotInputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: (args) => takeScreenshot(bridge, args),
  });
}
