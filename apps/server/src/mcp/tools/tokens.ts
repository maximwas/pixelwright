import type { McpServer } from "@modelcontextprotocol/server";
import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { READ_ONLY_ANNOTATIONS, WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import {
  TokensApplyOutputSchema,
  TokensApplyToolInputSchema,
  TokensReadInputSchema,
  TokensReadOutputSchema,
  TokensUsageInputSchema,
} from "../../schemas/tools.ts";
import { applyTokens, readTokens } from "../../tokens/tokens.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

export function registerTokensUsageTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "tokens_usage",
    title: "Where a token is used",
    description:
      "The layers on the current page (or inside within) that use a style or variable, named by its token as design_read and tokens_read write it (--White-2 is the second style named White, --h1-font a text style), with where each uses it (fill, stroke, effect, text, a text run, or a bound field). Use it to tell same-named styles apart or to see what a change to a token would touch.",
    input: TokensUsageInputSchema,
    output: OPERATION_SCHEMAS.usage.output,
    annotations: READ_ONLY_ANNOTATIONS,
    run: ({ file, ...usage }) => runOp(bridge, "usage", usage, file),
  });
}

export function registerTokensTool(server: McpServer, { bridge, support }: ToolContext): void {
  registerTool(server, {
    name: "tokens_read",
    title: "Read the design tokens",
    description:
      "Reads the file's design tokens: every variable collection with all its modes (light, dark…), and the paint, text and effect styles, its own and those the current page uses from a team library, named the way design_read writes them (var(--Name)). format css (default) returns ready CSS: :root holds each collection's default mode and the styles, and every other mode is a block [data-<collection>=\"<mode>\"] to put on the element a theme applies to; format json returns the same per collection and mode; format dtcg returns Design Tokens Format (DTCG 2025.10) trees, one per collection mode and one of styles, to save as token files for Style Dictionary or Tokens Studio. libraries: true also lists the enabled libraries' variables by name. notes say what could not be written.",
    input: TokensReadInputSchema,
    output: TokensReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readTokens(bridge, args),
  });
  registerTool(
    server,
    {
      name: "tokens_apply",
      title: "Write design tokens",
      description:
        "Writes design tokens in the shape tokens_read returns with format json: collections with their modes and variables, each mode's value in CSS (a colour, px or a number, a quoted string, true/false, var(--token) for an alias), and styles: paint (a colour or colour variable), text (the font shorthand) and effect (a box-shadow list). Collections, modes, variables and styles are found by name among the file's own or made; what the file already holds, as tokens_read writes it, is left as it is, and nothing is deleted. A library's collection or style is never copied into the file: change it in the library. Send only what you change. errors name each variable, mode or style that could not be written while the rest goes in. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun checks without writing).",
      input: TokensApplyToolInputSchema,
      output: TokensApplyOutputSchema,
      annotations: WRITE_ANNOTATIONS,
      run: (args) => applyTokens(bridge, args),
      changed: ({ dryRun, created, updated }) => !dryRun && created.length + updated.length > 0,
    },
    support,
  );
}
