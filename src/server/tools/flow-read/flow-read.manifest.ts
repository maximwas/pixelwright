import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { FLOW_READ_TOOL } from "@/server/tools/flow-read/flow-read.constants.ts";
import { FlowReadInputSchema, FlowReadOutputSchema } from "@/server/tools/flow-read/flow-read.schema.ts";

export const FLOW_READ_MANIFEST: ToolManifest = {
  name: FLOW_READ_TOOL.name,
  title: FLOW_READ_TOOL.title,
  description: FLOW_READ_TOOL.description,
  input: FlowReadInputSchema,
  output: FlowReadOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/flow-read/flow-read.tool.ts")).FlowReadTool,
};
