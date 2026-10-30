import { DesignLintSchema } from "@/core/checks/lint/lint.schema.ts";
import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { DESIGN_LINT_TOOL } from "@/server/tools/design-lint/design-lint.constants.ts";
import { DesignLintInputSchema } from "@/server/tools/design-lint/design-lint.schema.ts";

export const DESIGN_LINT_MANIFEST: ToolManifest = {
  name: DESIGN_LINT_TOOL.name,
  title: DESIGN_LINT_TOOL.title,
  description: DESIGN_LINT_TOOL.description,
  input: DesignLintInputSchema,
  output: DesignLintSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/design-lint/design-lint.tool.ts")).DesignLintTool,
};
