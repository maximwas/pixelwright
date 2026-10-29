import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { SELECTION_WAIT_TOOL } from "@/server/tools/selection-wait/selection-wait.constants.ts";
import {
  SelectionWaitInputSchema,
  SelectionWaitOutputSchema,
} from "@/server/tools/selection-wait/selection-wait.schema.ts";

export const SELECTION_WAIT_MANIFEST: ToolManifest = {
  name: SELECTION_WAIT_TOOL.name,
  title: SELECTION_WAIT_TOOL.title,
  description: SELECTION_WAIT_TOOL.description,
  input: SelectionWaitInputSchema,
  output: SelectionWaitOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/selection-wait/selection-wait.tool.ts")).SelectionWaitTool,
};
