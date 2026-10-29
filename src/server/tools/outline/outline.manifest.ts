import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { OUTLINE_TOOL } from "@/server/tools/outline/outline.constants.ts";
import { OutlineInputSchema, OutlineOutputSchema } from "@/server/tools/outline/outline.schema.ts";

export const OUTLINE_MANIFEST: ToolManifest = {
  name: OUTLINE_TOOL.name,
  title: OUTLINE_TOOL.title,
  description: OUTLINE_TOOL.description,
  input: OutlineInputSchema,
  output: OutlineOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/outline/outline.tool.ts")).OutlineTool,
};
