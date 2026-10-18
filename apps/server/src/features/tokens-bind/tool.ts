import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { bindTokens } from "./bind-tokens.ts";
import { TokensBindInputSchema, TokensBindOutputSchema } from "./schemas.ts";

export function tokensBindTool({
  plugin,
}: ToolContext): ToolDefinition<typeof TokensBindInputSchema, typeof TokensBindOutputSchema> {
  return {
    name: "tokens_bind",
    title: "Bind raw values to tokens",
    description:
      "Binds the raw values under a layer, a page or the file to the styles and variables that hold them exactly, in each layer's variable mode and within the variables' scopes: colours to colour variables or paint styles, gaps, padding, radii, border widths and opacity to number variables, texts to text styles, shadows and blurs to effect styles. A value one token holds is bound; one several hold is listed with its candidates (pick with choose); one none holds is listed too, for tokens_apply. choose also snaps a near value to a token. remap rebinds every use of one token to another of its kind, for merging duplicates. Instances are left to their main components. Results are grouped by value. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun lists without writing). design_lint says what is raw.",
    input: TokensBindInputSchema,
    output: TokensBindOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => bindTokens(plugin, args),
    changed: ({ dryRun, layers }) => !dryRun && layers > 0,
  };
}
