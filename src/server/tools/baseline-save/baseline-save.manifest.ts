import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { BASELINE_SAVE_TOOL } from "@/server/tools/baseline-save/baseline-save.constants.ts";
import {
  BaselineSaveInputSchema,
  BaselineSaveOutputSchema,
} from "@/server/tools/baseline-save/baseline-save.schema.ts";

/** A read: it writes a project file, nothing in Figma, so it works while Allow edits is off (T-200). */
export const BASELINE_SAVE_MANIFEST: ToolManifest = {
  name: BASELINE_SAVE_TOOL.name,
  title: BASELINE_SAVE_TOOL.title,
  description: BASELINE_SAVE_TOOL.description,
  input: BaselineSaveInputSchema,
  output: BaselineSaveOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/baseline-save/baseline-save.tool.ts")).BaselineSaveTool,
};
