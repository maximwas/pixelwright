import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { VERSION_SAVE_TOOL } from "@/server/tools/version-save/version-save.constants.ts";
import { VersionSaveInputSchema, VersionSaveOutputSchema } from "@/server/tools/version-save/version-save.schema.ts";

/** A write; it finds its file itself: the first baseline's, unless `file` names one (T-180). */
export const VERSION_SAVE_MANIFEST: ToolManifest = {
  name: VERSION_SAVE_TOOL.name,
  title: VERSION_SAVE_TOOL.title,
  description: VERSION_SAVE_TOOL.description,
  input: VersionSaveInputSchema,
  output: VersionSaveOutputSchema,
  annotations: TOOL_ANNOTATIONS.write,
  ownTarget: true,
  load: async () => (await import("@/server/tools/version-save/version-save.tool.ts")).VersionSaveTool,
};
