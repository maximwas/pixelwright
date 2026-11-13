import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOKENS_APPLY_TOOL } from "@/server/tools/tokens-apply/tokens-apply.constants.ts";
import { TokensApplyInputSchema, TokensApplyOutputSchema } from "@/server/tools/tokens-apply/tokens-apply.schema.ts";

/** A write: clients ask before each call. */
export const TOKENS_APPLY_MANIFEST: ToolManifest = {
  name: TOKENS_APPLY_TOOL.name,
  title: TOKENS_APPLY_TOOL.title,
  description: TOKENS_APPLY_TOOL.description,
  input: TokensApplyInputSchema,
  output: TokensApplyOutputSchema,
  annotations: TOOL_ANNOTATIONS.write,
  load: async () => (await import("@/server/tools/tokens-apply/tokens-apply.tool.ts")).TokensApplyTool,
};
