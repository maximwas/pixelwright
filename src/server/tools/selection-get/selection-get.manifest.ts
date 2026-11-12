import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { SELECTION_GET_TOOL } from "@/server/tools/selection-get/selection-get.constants.ts";
import {
  SelectionGetInputSchema,
  SelectionGetOutputSchema,
} from "@/server/tools/selection-get/selection-get.schema.ts";

export const SELECTION_GET_MANIFEST: ToolManifest = {
  name: SELECTION_GET_TOOL.name,
  title: SELECTION_GET_TOOL.title,
  description: SELECTION_GET_TOOL.description,
  input: SelectionGetInputSchema,
  output: SelectionGetOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/selection-get/selection-get.tool.ts")).SelectionGetTool,
};
