import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { EXECUTE_TOOL } from "@/server/tools/execute/execute.constants.ts";
import { ExecuteInputSchema, ExecuteOutputSchema } from "@/server/tools/execute/execute.schema.ts";

export const EXECUTE_MANIFEST: ToolManifest = {
  name: EXECUTE_TOOL.name,
  title: EXECUTE_TOOL.title,
  description: EXECUTE_TOOL.description,
  input: ExecuteInputSchema,
  output: ExecuteOutputSchema,
  annotations: TOOL_ANNOTATIONS.write,
  load: async () => (await import("@/server/tools/execute/execute.tool.ts")).ExecuteTool,
};
