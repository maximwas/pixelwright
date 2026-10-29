import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { NODES_FIND_TOOL } from "@/server/tools/nodes-find/nodes-find.constants.ts";
import { NodesFindInputSchema, NodesFindOutputSchema } from "@/server/tools/nodes-find/nodes-find.schema.ts";

export const NODES_FIND_MANIFEST: ToolManifest = {
  name: NODES_FIND_TOOL.name,
  title: NODES_FIND_TOOL.title,
  description: NODES_FIND_TOOL.description,
  input: NodesFindInputSchema,
  output: NodesFindOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/nodes-find/nodes-find.tool.ts")).NodesFindTool,
};
