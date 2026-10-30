import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { STYLES_COMPARE_TOOL } from "@/server/tools/styles-compare/styles-compare.constants.ts";
import {
  StylesCompareInputSchema,
  StylesCompareOutputSchema,
} from "@/server/tools/styles-compare/styles-compare.schema.ts";

export const STYLES_COMPARE_MANIFEST: ToolManifest = {
  name: STYLES_COMPARE_TOOL.name,
  title: STYLES_COMPARE_TOOL.title,
  description: STYLES_COMPARE_TOOL.description,
  input: StylesCompareInputSchema,
  output: StylesCompareOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/styles-compare/styles-compare.tool.ts")).StylesCompareTool,
};
