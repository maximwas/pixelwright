import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { executeCode } from "./execute-code.ts";
import { ExecuteInputSchema, ExecuteOutputSchema } from "./schemas.ts";

export function executeTool({
  plugin,
}: ToolContext): ToolDefinition<typeof ExecuteInputSchema, typeof ExecuteOutputSchema> {
  return {
    name: "execute",
    title: "Run plugin code",
    description:
      "Runs JavaScript in the Pixelwright plugin, for what design_apply and tokens_apply cannot say: the code is the body of an async function given `figma` (the Plugin API) and `console`; `return` gives `result` (layers come back as {id, type, name}, figma.mixed as \"mixed\"), and what it logs comes back as `logs`. What it throws comes back as `error`, with the logs before it. What it changes during the call is one undo step in Figma. Refused while the plugin's Allow edits switch is off, but code it starts that outlives the call (timers, listeners, work past the timeout) keeps running until the plugin window is closed, the switch notwithstanding. The tool waits at most 25 s; an endless loop, synchronous or of awaits, freezes Figma until the plugin is closed. Prefer the XML and token tools: they keep the file's styles and check what they write.",
    input: ExecuteInputSchema,
    output: ExecuteOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => executeCode(plugin, args),
  };
}
