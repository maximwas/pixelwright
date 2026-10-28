import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { STATUS_TOOL } from "./status.constants.ts";
import { StatusInputSchema, StatusOutputSchema } from "./status.schema.ts";

export const STATUS_MANIFEST: ToolManifest = {
  name: STATUS_TOOL.name,
  title: STATUS_TOOL.title,
  description: STATUS_TOOL.description,
  input: StatusInputSchema,
  output: StatusOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("./status.tool.ts")).StatusTool,
};
