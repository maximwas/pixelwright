import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { IMAGE_COMPARE_TOOL } from "@/server/tools/image-compare/image-compare.constants.ts";
import {
  ImageCompareInputSchema,
  ImageCompareOutputSchema,
} from "@/server/tools/image-compare/image-compare.schema.ts";

/** Read-only even with diff, as screenshot with save (D-14): the difference goes only to a .png path. */
export const IMAGE_COMPARE_MANIFEST: ToolManifest = {
  name: IMAGE_COMPARE_TOOL.name,
  title: IMAGE_COMPARE_TOOL.title,
  description: IMAGE_COMPARE_TOOL.description,
  input: ImageCompareInputSchema,
  output: ImageCompareOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/image-compare/image-compare.tool.ts")).ImageCompareTool,
};
