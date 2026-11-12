import { MeasureSchema } from "@/core/inspect/inspect.schema.ts";
import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { MEASURE_TOOL } from "@/server/tools/measure/measure.constants.ts";
import { MeasureInputSchema } from "@/server/tools/measure/measure.schema.ts";

export const MEASURE_MANIFEST: ToolManifest = {
  name: MEASURE_TOOL.name,
  title: MEASURE_TOOL.title,
  description: MEASURE_TOOL.description,
  input: MeasureInputSchema,
  output: MeasureSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/measure/measure.tool.ts")).MeasureTool,
};
