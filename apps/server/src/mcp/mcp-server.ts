import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerApplyTool } from "./tools/apply.ts";
import { registerAssetsTool } from "./tools/assets.ts";
import { registerChecksTools } from "./tools/checks.ts";
import { registerCodeConnectTool } from "./tools/code-connect.ts";
import { registerComponentsTool } from "./tools/components.ts";
import { registerDesignTool } from "./tools/design.ts";
import { registerDiffTool } from "./tools/diff.ts";
import { registerExecuteTool } from "./tools/execute.ts";
import { registerFlowsTool } from "./tools/flows.ts";
import { registerGuideTool } from "./tools/guide.ts";
import { registerImageCompareTool } from "./tools/image-compare.ts";
import { registerInspectTool } from "./tools/inspect.ts";
import { registerMeasureTool } from "./tools/measure.ts";
import { registerNodeTools } from "./tools/nodes.ts";
import { registerScreenshotTool } from "./tools/screenshot.ts";
import { registerStatusTool } from "./tools/status.ts";
import { registerTokensTool, registerTokensUsageTool } from "./tools/tokens.ts";

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
  registerInspectTool(server, context);
  registerDiffTool(server, context);
  registerImageCompareTool(server, context);
  registerMeasureTool(server, context);
  registerFlowsTool(server, context);
  registerChecksTools(server, context);
  registerTokensUsageTool(server, context);
  registerApplyTool(server, context);
  registerExecuteTool(server, context);
  registerTokensTool(server, context);
  registerComponentsTool(server, context);
  registerAssetsTool(server, context);
  registerCodeConnectTool(server, context);
  registerGuideTool(server);

  return server;
}
