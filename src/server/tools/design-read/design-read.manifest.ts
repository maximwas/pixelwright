import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { DESIGN_READ_TOOL } from "@/server/tools/design-read/design-read.constants.ts";
import { DesignReadInputSchema } from "@/server/tools/design-read/design-read.schema.ts";

/** No output: design_read answers in text blocks, the XML and the JSON (T-005, FX-067). */
export const DESIGN_READ_MANIFEST: ToolManifest = {
  name: DESIGN_READ_TOOL.name,
  title: DESIGN_READ_TOOL.title,
  description: DESIGN_READ_TOOL.description,
  input: DesignReadInputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/design-read/design-read.tool.ts")).DesignReadTool,
};
