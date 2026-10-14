import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { readCodeConnect } from "./read-code-connect.ts";
import { CodeConnectReadInputSchema, CodeConnectReadOutputSchema } from "./schemas.ts";

export function codeConnectReadTool({
  plugin,
  projectRoot,
}: ToolContext): ToolDefinition<typeof CodeConnectReadInputSchema, typeof CodeConnectReadOutputSchema> {
  return {
    name: "code_connect_read",
    title: "Read the Code Connect templates",
    description:
      "Lists the project's Figma Code Connect files (templates *.figma.ts and *.figma.js, batch files *.figma.batch.json, as figma.config.json's globs name them) with what each connects on the current page, or inside `node`: components with how many instances and how each matched (by key, id or name), and what a trial run on the first gives: its error, the properties its code never reads (`unread`) and the variant values its mapping misses (`values`); `missing` marks a source file that does not exist. Also the components shown there that none connects, with the id and key a new one needs, and what keeps a file out. design_read returns their code as codeComponents. Write them with your file tools as Figma documents them (guide topic code-connect).",
    input: CodeConnectReadInputSchema,
    output: CodeConnectReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (input) => readCodeConnect(plugin, input, projectRoot),
  };
}
