import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import { changesSinceTool } from "../features/changes-since/tool.ts";
import { componentsReadTool } from "../features/components-read/tool.ts";
import { designApplyTool } from "../features/design-apply/tool.ts";
import { fileMapTool } from "../features/file-map/tool.ts";
import { flowReadTool } from "../features/flow-read/tool.ts";
import { nodeShowTool } from "../features/node-show/tool.ts";
import { nodesDeleteTool } from "../features/nodes-delete/tool.ts";
import { nodesFindTool } from "../features/nodes-find/tool.ts";
import { outlineTool } from "../features/outline/tool.ts";
import { selectionGetTool } from "../features/selection-get/tool.ts";
import { selectionWaitTool } from "../features/selection-wait/tool.ts";
import { statusTool } from "../features/status/tool.ts";
import { tokensApplyTool } from "../features/tokens-apply/tool.ts";
import { tokensReadTool } from "../features/tokens-read/tool.ts";
import { tokensUsageTool } from "../features/tokens-usage/tool.ts";
import { viewportGetTool } from "../features/viewport-get/tool.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerTool } from "./register-tool.ts";
import { registerAssetsTool } from "./tools/assets.ts";
import { registerChecksTools } from "./tools/checks.ts";
import { registerCodeConnectTool } from "./tools/code-connect.ts";
import { registerVariantsTool } from "./tools/components.ts";
import { registerDesignTool } from "./tools/design.ts";
import { registerBreakpointsTool, registerDiffTool } from "./tools/diff.ts";
import { registerExecuteTool } from "./tools/execute.ts";
import { registerGuideTool } from "./tools/guide.ts";
import { registerImageCompareTool } from "./tools/image-compare.ts";
import { registerInspectTool } from "./tools/inspect.ts";
import { registerMeasureTool } from "./tools/measure.ts";
import { registerScreenshotTool } from "./tools/screenshot.ts";

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer(
    {
      name: "pixelwright",
      version: context.version,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerTool(server, statusTool(context));
  registerTool(server, selectionGetTool(context));
  registerTool(server, nodeShowTool(context));
  registerTool(server, selectionWaitTool(context));
  registerTool(server, changesSinceTool(context));
  registerTool(server, fileMapTool(context));
  registerTool(server, viewportGetTool(context));
  registerTool(server, nodesFindTool(context));
  registerTool(server, outlineTool(context));
  registerTool(server, nodesDeleteTool(context), context.support);
  registerScreenshotTool(server, context);
  registerDesignTool(server, context);
  registerInspectTool(server, context);
  registerDiffTool(server, context);
  registerBreakpointsTool(server, context);
  registerImageCompareTool(server, context);
  registerMeasureTool(server, context);
  registerTool(server, flowReadTool(context));
  registerChecksTools(server, context);
  registerTool(server, tokensUsageTool(context));
  registerTool(server, designApplyTool(context), context.support);
  registerExecuteTool(server, context);
  registerTool(server, tokensReadTool(context));
  registerTool(server, tokensApplyTool(context), context.support);
  registerTool(server, componentsReadTool(context));
  registerVariantsTool(server, context);
  registerAssetsTool(server, context);
  registerCodeConnectTool(server, context);
  registerGuideTool(server);

  return server;
}
