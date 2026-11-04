import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { GUIDE_TOOL } from "@/server/tools/guide/guide.constants.ts";
import { GuideInputSchema, GuideOutputSchema } from "@/server/tools/guide/guide.schema.ts";

export const GUIDE_MANIFEST: ToolManifest = {
  name: GUIDE_TOOL.name,
  title: GUIDE_TOOL.title,
  description: GUIDE_TOOL.description,
  input: GuideInputSchema,
  output: GuideOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/guide/guide.tool.ts")).GuideTool,
};
