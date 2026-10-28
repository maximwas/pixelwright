import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { CHANGES_SINCE_TOOL } from "@/server/tools/changes-since/changes-since.constants.ts";
import {
  ChangesSinceInputSchema,
  ChangesSinceOutputSchema,
} from "@/server/tools/changes-since/changes-since.schema.ts";

export const CHANGES_SINCE_MANIFEST: ToolManifest = {
  name: CHANGES_SINCE_TOOL.name,
  title: CHANGES_SINCE_TOOL.title,
  description: CHANGES_SINCE_TOOL.description,
  input: ChangesSinceInputSchema,
  output: ChangesSinceOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/changes-since/changes-since.tool.ts")).ChangesSinceTool,
};
