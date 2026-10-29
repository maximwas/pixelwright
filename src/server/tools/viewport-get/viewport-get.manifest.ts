import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { VIEWPORT_GET_TOOL } from "@/server/tools/viewport-get/viewport-get.constants.ts";
import { ViewportGetInputSchema, ViewportGetOutputSchema } from "@/server/tools/viewport-get/viewport-get.schema.ts";

export const VIEWPORT_GET_MANIFEST: ToolManifest = {
  name: VIEWPORT_GET_TOOL.name,
  title: VIEWPORT_GET_TOOL.title,
  description: VIEWPORT_GET_TOOL.description,
  input: ViewportGetInputSchema,
  output: ViewportGetOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/viewport-get/viewport-get.tool.ts")).ViewportGetTool,
};
