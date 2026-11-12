import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { NODES_DIFF_TOOL } from "@/server/tools/nodes-diff/nodes-diff.constants.ts";
import { NodesDiffInputSchema, NodesDiffOutputSchema } from "@/server/tools/nodes-diff/nodes-diff.schema.ts";

export const NODES_DIFF_MANIFEST: ToolManifest = {
  name: NODES_DIFF_TOOL.name,
  title: NODES_DIFF_TOOL.title,
  description: NODES_DIFF_TOOL.description,
  input: NodesDiffInputSchema,
  output: NodesDiffOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/nodes-diff/nodes-diff.tool.ts")).NodesDiffTool,
};
