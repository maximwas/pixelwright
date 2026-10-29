import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { NODE_SHOW_TOOL } from "@/server/tools/node-show/node-show.constants.ts";
import { NodeShowInputSchema, NodeShowOutputSchema } from "@/server/tools/node-show/node-show.schema.ts";

/** Annotated read-only by the T-032 ruling: it moves the user's view and selection, never the file. */
export const NODE_SHOW_MANIFEST: ToolManifest = {
  name: NODE_SHOW_TOOL.name,
  title: NODE_SHOW_TOOL.title,
  description: NODE_SHOW_TOOL.description,
  input: NodeShowInputSchema,
  output: NodeShowOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/node-show/node-show.tool.ts")).NodeShowTool,
};
