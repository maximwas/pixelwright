import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { BASELINE_DIFF_TOOL } from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import {
  BaselineDiffInputSchema,
  BaselineDiffOutputSchema,
} from "@/server/tools/baseline-diff/baseline-diff.schema.ts";

/** A read: it reads the project's baselines and Figma, writes nothing, so it works while Allow edits is off (T-205). */
export const BASELINE_DIFF_MANIFEST: ToolManifest = {
  name: BASELINE_DIFF_TOOL.name,
  title: BASELINE_DIFF_TOOL.title,
  description: BASELINE_DIFF_TOOL.description,
  input: BaselineDiffInputSchema,
  output: BaselineDiffOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/baseline-diff/baseline-diff.tool.ts")).BaselineDiffTool,
};
