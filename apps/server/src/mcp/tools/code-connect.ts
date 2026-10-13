import type { McpServer } from "@modelcontextprotocol/server";
import { readCodeConnect } from "../../code-connect/read-code-connect.ts";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { CodeConnectReadInputSchema, CodeConnectReadOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerCodeConnectTool(server: McpServer, { bridge, projectRoot }: ToolContext): void {
  registerTool(server, {
    name: "code_connect_read",
    title: "Read the Code Connect templates",
    description:
      "Lists the project's Figma Code Connect templates (*.figma.ts and *.figma.js, as figma.config.json's globs name them) with what each connects on the current page, or inside `node`: components with how many instances, and the error a trial run on the first one gives. Also the components used there that no template connects, and what keeps a template out. design_read returns the code these templates give as codeComponents. Templates are code: write them with your file tools as Figma documents them (guide topic code-connect).",
    input: CodeConnectReadInputSchema,
    output: CodeConnectReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (input) => readCodeConnect(bridge, input, projectRoot),
  });
}
