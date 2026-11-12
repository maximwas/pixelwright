import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { BREAKPOINTS_FIND_TOOL } from "@/server/tools/breakpoints-find/breakpoints-find.constants.ts";
import {
  BreakpointsFindInputSchema,
  BreakpointsFindOutputSchema,
} from "@/server/tools/breakpoints-find/breakpoints-find.schema.ts";

export const BREAKPOINTS_FIND_MANIFEST: ToolManifest = {
  name: BREAKPOINTS_FIND_TOOL.name,
  title: BREAKPOINTS_FIND_TOOL.title,
  description: BREAKPOINTS_FIND_TOOL.description,
  input: BreakpointsFindInputSchema,
  output: BreakpointsFindOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/breakpoints-find/breakpoints-find.tool.ts")).BreakpointsFindTool,
};
