import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOKENS_READ_TOOL } from "@/server/tools/tokens-read/tokens-read.constants.ts";
import { TokensReadInputSchema, TokensReadOutputSchema } from "@/server/tools/tokens-read/tokens-read.schema.ts";

export const TOKENS_READ_MANIFEST: ToolManifest = {
  name: TOKENS_READ_TOOL.name,
  title: TOKENS_READ_TOOL.title,
  description: TOKENS_READ_TOOL.description,
  input: TokensReadInputSchema,
  output: TokensReadOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/tokens-read/tokens-read.tool.ts")).TokensReadTool,
};
