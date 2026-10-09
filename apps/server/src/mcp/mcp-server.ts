import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerApplyTool } from "./tools/apply.ts";
import { registerAssetsTool } from "./tools/assets.ts";
import { registerComponentsTool } from "./tools/components.ts";
import { registerDesignTool } from "./tools/design.ts";
import { registerExecuteTool } from "./tools/execute.ts";
import { registerGuideTool } from "./tools/guide.ts";
import { registerNodeTools } from "./tools/nodes.ts";
import { registerScreenshotTool } from "./tools/screenshot.ts";
import { registerStatusTool } from "./tools/status.ts";
import { registerTokensTool } from "./tools/tokens.ts";

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
  registerApplyTool(server, context);
  registerExecuteTool(server, context);
  registerTokensTool(server, context);
  registerComponentsTool(server, context);
  registerAssetsTool(server, context);
  registerGuideTool(server);

  return server;
}
