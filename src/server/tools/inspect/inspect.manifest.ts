import { InspectViewSchema } from "@/core/inspect/inspect.schema.ts";
import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { INSPECT_TOOL } from "@/server/tools/inspect/inspect.constants.ts";
import { InspectInputSchema } from "@/server/tools/inspect/inspect.schema.ts";

export const INSPECT_MANIFEST: ToolManifest = {
  name: INSPECT_TOOL.name,
  title: INSPECT_TOOL.title,
  description: INSPECT_TOOL.description,
  input: InspectInputSchema,
  output: InspectViewSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/inspect/inspect.tool.ts")).InspectTool,
};
