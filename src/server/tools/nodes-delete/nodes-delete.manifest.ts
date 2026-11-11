import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { NODES_DELETE_TOOL } from "@/server/tools/nodes-delete/nodes-delete.constants.ts";
import { NodesDeleteInputSchema, NodesDeleteOutputSchema } from "@/server/tools/nodes-delete/nodes-delete.schema.ts";

/** A write: clients ask before each call; a dry run works with Allow edits off (T-045, D-35). */
export const NODES_DELETE_MANIFEST: ToolManifest = {
  name: NODES_DELETE_TOOL.name,
  title: NODES_DELETE_TOOL.title,
  description: NODES_DELETE_TOOL.description,
  input: NodesDeleteInputSchema,
  output: NodesDeleteOutputSchema,
  annotations: TOOL_ANNOTATIONS.write,
  load: async () => (await import("@/server/tools/nodes-delete/nodes-delete.tool.ts")).NodesDeleteTool,
};
