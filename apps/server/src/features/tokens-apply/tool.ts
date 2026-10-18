import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { applyTokens } from "./apply-tokens.ts";
import { TokensApplyOutputSchema, TokensApplyToolInputSchema } from "./schemas.ts";

export function tokensApplyTool({
  plugin,
}: ToolContext): ToolDefinition<typeof TokensApplyToolInputSchema, typeof TokensApplyOutputSchema> {
  return {
    name: "tokens_apply",
    title: "Write design tokens",
    description:
      "Writes design tokens in the shape tokens_read returns with format json: collections with their modes and variables, each mode's value in CSS (a colour, px or a number, a quoted string, true/false, var(--token) for an alias), optionally scopes (where Figma's pickers offer it: a font weight or an opacity needs FONT_WEIGHT or OPACITY to stay a plain number) and codeSyntax per platform, and styles: paint (a colour or colour variable), text (the font shorthand) and effect (a box-shadow list). Collections, modes, variables and styles are found by name among the file's own or made; what the file already holds, as tokens_read writes it, is left as it is, and nothing is deleted. A library's collection or style is never copied into the file: change it in the library. Send only what you change. errors name each variable, mode or style that could not be written while the rest goes in; notes, what was written but will not read back as given. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun checks without writing).",
    input: TokensApplyToolInputSchema,
    output: TokensApplyOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => applyTokens(plugin, args),
    changed: ({ dryRun, created, updated }) => !dryRun && created.length + updated.length > 0,
  };
}
