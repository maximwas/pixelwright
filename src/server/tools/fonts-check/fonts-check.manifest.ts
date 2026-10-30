import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { FONTS_CHECK_TOOL } from "@/server/tools/fonts-check/fonts-check.constants.ts";
import { FontsCheckInputSchema, FontsCheckOutputSchema } from "@/server/tools/fonts-check/fonts-check.schema.ts";

/** A read that asks the web (Fontsource, Google Fonts) what is served: openWorldHint (T-101). */
export const FONTS_CHECK_MANIFEST: ToolManifest = {
  name: FONTS_CHECK_TOOL.name,
  title: FONTS_CHECK_TOOL.title,
  description: FONTS_CHECK_TOOL.description,
  input: FontsCheckInputSchema,
  output: FontsCheckOutputSchema,
  annotations: { ...TOOL_ANNOTATIONS.read, openWorldHint: true },
  load: async () => (await import("@/server/tools/fonts-check/fonts-check.tool.ts")).FontsCheckTool,
};
