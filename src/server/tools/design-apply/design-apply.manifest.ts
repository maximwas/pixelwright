import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { DESIGN_APPLY_TOOL } from "@/server/tools/design-apply/design-apply.constants.ts";
import { DesignApplyInputSchema, DesignApplyOutputSchema } from "@/server/tools/design-apply/design-apply.schema.ts";

/** A write: clients ask before each call; it asks Fontsource for a variable font's axis ranges (openWorldHint). */
export const DESIGN_APPLY_MANIFEST: ToolManifest = {
  name: DESIGN_APPLY_TOOL.name,
  title: DESIGN_APPLY_TOOL.title,
  description: DESIGN_APPLY_TOOL.description,
  input: DesignApplyInputSchema,
  output: DesignApplyOutputSchema,
  annotations: { ...TOOL_ANNOTATIONS.write, openWorldHint: true },
  load: async () => (await import("@/server/tools/design-apply/design-apply.tool.ts")).DesignApplyTool,
};
