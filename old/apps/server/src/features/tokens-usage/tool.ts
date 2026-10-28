import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { TokensUsageInputSchema } from "./schemas.ts";

export function tokensUsageTool({
  plugin,
}: ToolContext): ToolDefinition<typeof TokensUsageInputSchema, typeof OPERATION_SCHEMAS.usage.output> {
  return {
    name: "tokens_usage",
    title: "Where a token is used",
    description:
      'The layers on the current page (or inside within, or on every page with within: "file") that use a style or variable, named by its token as design_read and tokens_read write it (--White-2 is the second style named White, --h1-font a text style), with where each uses it (fill, stroke, effect, text, a text run, or a bound field). Use it to tell same-named styles apart or to see what a change to a token would touch.',
    input: TokensUsageInputSchema,
    output: OPERATION_SCHEMAS.usage.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...usage }) => plugin.run("usage", usage, file),
  };
}
