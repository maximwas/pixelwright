import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerDesignTool } from "./tools/design.ts";
import { registerNodeTools } from "./tools/nodes.ts";
import { registerScreenshotTool } from "./tools/screenshot.ts";
import { registerStatusTool } from "./tools/status.ts";

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer(
    {
      name: "pixelwright",
      version: context.version,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerStatusTool(server, context);
  registerNodeTools(server, context);
  registerScreenshotTool(server, context);
  registerDesignTool(server, context);

  return server;
}
