import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readTokens } from "./read-tokens.ts";
import { TokensReadInputSchema, TokensReadOutputSchema } from "./schemas.ts";

export function tokensReadTool({
  plugin,
}: ToolContext): ToolDefinition<typeof TokensReadInputSchema, typeof TokensReadOutputSchema> {
  return {
    name: "tokens_read",
    title: "Read the design tokens",
    description:
      "Reads the file's design tokens: every variable collection with all its modes (light, dark…), and the paint, text and effect styles, its own and those the current page uses from a team library, named the way design_read writes them (var(--Name)). format css (default) returns ready CSS: :root holds each collection's default mode and the styles, and every other mode is a block [data-<collection>=\"<mode>\"] to put on the element a theme applies to; format json returns the same per collection and mode; format dtcg returns Design Tokens Format (DTCG 2025.10) trees, one per collection mode and one of styles, to save as token files for Style Dictionary or Tokens Studio. libraries: true also lists the enabled libraries' variables by name. notes say what could not be written.",
    input: TokensReadInputSchema,
    output: TokensReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readTokens(plugin, args),
  };
}
