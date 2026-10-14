import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import { designApplyTool } from "../features/design-apply/tool.ts";
import { nodesDeleteTool } from "../features/nodes-delete/tool.ts";
import { tokensApplyTool } from "../features/tokens-apply/tool.ts";
import { tokensReadTool } from "../features/tokens-read/tool.ts";
import { tokensUsageTool } from "../features/tokens-usage/tool.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerTool } from "./register-tool.ts";
import { registerAssetsTool } from "./tools/assets.ts";
import { registerChecksTools } from "./tools/checks.ts";
import { registerCodeConnectTool } from "./tools/code-connect.ts";
import { registerComponentsTool, registerVariantsTool } from "./tools/components.ts";
import { registerDesignTool } from "./tools/design.ts";
import { registerBreakpointsTool, registerDiffTool } from "./tools/diff.ts";
import { registerExecuteTool } from "./tools/execute.ts";
import { registerFlowsTool } from "./tools/flows.ts";
import { registerGuideTool } from "./tools/guide.ts";
import { registerImageCompareTool } from "./tools/image-compare.ts";
import { registerInspectTool } from "./tools/inspect.ts";
import { registerMeasureTool } from "./tools/measure.ts";
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
  registerTool(server, nodesDeleteTool(context), context.support);
  registerScreenshotTool(server, context);
  registerDesignTool(server, context);
  registerInspectTool(server, context);
  registerDiffTool(server, context);
  registerBreakpointsTool(server, context);
  registerImageCompareTool(server, context);
  registerMeasureTool(server, context);
  registerFlowsTool(server, context);
  registerChecksTools(server, context);
  registerTool(server, tokensUsageTool(context));
  registerTool(server, designApplyTool(context), context.support);
  registerExecuteTool(server, context);
  registerTool(server, tokensReadTool(context));
  registerTool(server, tokensApplyTool(context), context.support);
  registerComponentsTool(server, context);
  registerVariantsTool(server, context);
  registerAssetsTool(server, context);
  registerCodeConnectTool(server, context);
  registerGuideTool(server);

  return server;
}
