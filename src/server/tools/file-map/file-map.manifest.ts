import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { FILE_MAP_TOOL } from "@/server/tools/file-map/file-map.constants.ts";
import { FileMapInputSchema, FileMapOutputSchema } from "@/server/tools/file-map/file-map.schema.ts";

export const FILE_MAP_MANIFEST: ToolManifest = {
  name: FILE_MAP_TOOL.name,
  title: FILE_MAP_TOOL.title,
  description: FILE_MAP_TOOL.description,
  input: FileMapInputSchema,
  output: FileMapOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/file-map/file-map.tool.ts")).FileMapTool,
};
