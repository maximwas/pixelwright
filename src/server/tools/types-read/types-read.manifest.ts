import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TYPES_READ_TOOL } from "@/server/tools/types-read/types-read.constants.ts";
import { TypesReadInputSchema, TypesReadOutputSchema } from "@/server/tools/types-read/types-read.schema.ts";

export const TYPES_READ_MANIFEST: ToolManifest = {
  name: TYPES_READ_TOOL.name,
  title: TYPES_READ_TOOL.title,
  description: TYPES_READ_TOOL.description,
  input: TypesReadInputSchema,
  output: TypesReadOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/types-read/types-read.tool.ts")).TypesReadTool,
};
