import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { SCREENSHOT_TOOL } from "@/server/tools/screenshot/screenshot.constants.ts";
import { ScreenshotInputSchema } from "@/server/tools/screenshot/screenshot.schema.ts";

/** No output: an outputSchema makes a client drop the image block (T-005); read-only even with save (D-14). */
export const SCREENSHOT_MANIFEST: ToolManifest = {
  name: SCREENSHOT_TOOL.name,
  title: SCREENSHOT_TOOL.title,
  description: SCREENSHOT_TOOL.description,
  input: ScreenshotInputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/screenshot/screenshot.tool.ts")).ScreenshotTool,
};
