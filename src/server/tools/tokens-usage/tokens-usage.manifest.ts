import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOKENS_USAGE_TOOL } from "@/server/tools/tokens-usage/tokens-usage.constants.ts";
import { TokensUsageInputSchema, TokensUsageOutputSchema } from "@/server/tools/tokens-usage/tokens-usage.schema.ts";

export const TOKENS_USAGE_MANIFEST: ToolManifest = {
  name: TOKENS_USAGE_TOOL.name,
  title: TOKENS_USAGE_TOOL.title,
  description: TOKENS_USAGE_TOOL.description,
  input: TokensUsageInputSchema,
  output: TokensUsageOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/tokens-usage/tokens-usage.tool.ts")).TokensUsageTool,
};
