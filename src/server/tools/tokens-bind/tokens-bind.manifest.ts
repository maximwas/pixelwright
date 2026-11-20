import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOKENS_BIND_TOOL } from "@/server/tools/tokens-bind/tokens-bind.constants.ts";
import { TokensBindInputSchema, TokensBindOutputSchema } from "@/server/tools/tokens-bind/tokens-bind.schema.ts";

/** A write: clients ask before each call. */
export const TOKENS_BIND_MANIFEST: ToolManifest = {
  name: TOKENS_BIND_TOOL.name,
  title: TOKENS_BIND_TOOL.title,
  description: TOKENS_BIND_TOOL.description,
  input: TokensBindInputSchema,
  output: TokensBindOutputSchema,
  annotations: TOOL_ANNOTATIONS.write,
  load: async () => (await import("@/server/tools/tokens-bind/tokens-bind.tool.ts")).TokensBindTool,
};
