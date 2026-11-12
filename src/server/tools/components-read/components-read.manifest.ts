import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { COMPONENTS_READ_TOOL } from "@/server/tools/components-read/components-read.constants.ts";
import {
  ComponentsReadInputSchema,
  ComponentsReadOutputSchema,
} from "@/server/tools/components-read/components-read.schema.ts";

export const COMPONENTS_READ_MANIFEST: ToolManifest = {
  name: COMPONENTS_READ_TOOL.name,
  title: COMPONENTS_READ_TOOL.title,
  description: COMPONENTS_READ_TOOL.description,
  input: ComponentsReadInputSchema,
  output: ComponentsReadOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/components-read/components-read.tool.ts")).ComponentsReadTool,
};
