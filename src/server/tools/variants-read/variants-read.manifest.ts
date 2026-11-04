import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { VARIANTS_READ_TOOL } from "@/server/tools/variants-read/variants-read.constants.ts";
import {
  VariantsReadInputSchema,
  VariantsReadOutputSchema,
} from "@/server/tools/variants-read/variants-read.schema.ts";

export const VARIANTS_READ_MANIFEST: ToolManifest = {
  name: VARIANTS_READ_TOOL.name,
  title: VARIANTS_READ_TOOL.title,
  description: VARIANTS_READ_TOOL.description,
  input: VariantsReadInputSchema,
  output: VariantsReadOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/variants-read/variants-read.tool.ts")).VariantsReadTool,
};
