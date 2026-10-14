import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import { breakpointsFindTool } from "../features/breakpoints-find/tool.ts";
import { changesSinceTool } from "../features/changes-since/tool.ts";
import { componentsReadTool } from "../features/components-read/tool.ts";
import { contrastCheckTool } from "../features/contrast-check/tool.ts";
import { designApplyTool } from "../features/design-apply/tool.ts";
import { designAuditTool } from "../features/design-audit/tool.ts";
import { executeTool } from "../features/execute/tool.ts";
import { fileMapTool } from "../features/file-map/tool.ts";
import { flowReadTool } from "../features/flow-read/tool.ts";
import { fontsCheckTool } from "../features/fonts-check/tool.ts";
import { inspectTool } from "../features/inspect/tool.ts";
import { measureTool } from "../features/measure/tool.ts";
import { nodeShowTool } from "../features/node-show/tool.ts";
import { nodesDeleteTool } from "../features/nodes-delete/tool.ts";
import { nodesDiffTool } from "../features/nodes-diff/tool.ts";
import { nodesFindTool } from "../features/nodes-find/tool.ts";
import { outlineTool } from "../features/outline/tool.ts";
import { selectionGetTool } from "../features/selection-get/tool.ts";
import { selectionWaitTool } from "../features/selection-wait/tool.ts";
import { statusTool } from "../features/status/tool.ts";
import { tokensApplyTool } from "../features/tokens-apply/tool.ts";
import { tokensReadTool } from "../features/tokens-read/tool.ts";
import { tokensUsageTool } from "../features/tokens-usage/tool.ts";
import { variantsReadTool } from "../features/variants-read/tool.ts";
import { viewportGetTool } from "../features/viewport-get/tool.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerTool } from "./register-tool.ts";
import { registerAssetsTool } from "./tools/assets.ts";
import { registerCodeConnectTool } from "./tools/code-connect.ts";
import { registerDesignTool } from "./tools/design.ts";
import { registerGuideTool } from "./tools/guide.ts";
import { registerImageCompareTool } from "./tools/image-compare.ts";
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
  registerTool(server, inspectTool(context));
  registerTool(server, nodesDiffTool(context));
  registerTool(server, breakpointsFindTool(context));
  registerImageCompareTool(server, context);
  registerTool(server, measureTool(context));
  registerTool(server, flowReadTool(context));
  registerTool(server, contrastCheckTool(context));
  registerTool(server, fontsCheckTool(context));
  registerTool(server, designAuditTool(context));
  registerTool(server, tokensUsageTool(context));
  registerTool(server, designApplyTool(context), context.support);
  registerTool(server, executeTool(context));
  registerTool(server, tokensReadTool(context));
  registerTool(server, tokensApplyTool(context), context.support);
  registerTool(server, componentsReadTool(context));
  registerTool(server, variantsReadTool(context));
  registerAssetsTool(server, context);
  registerCodeConnectTool(server, context);
  registerGuideTool(server);

  return server;
}
