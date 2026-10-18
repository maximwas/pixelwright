import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "../constants/mcp.ts";
import { a11yReadTool } from "../features/a11y-read/tool.ts";
import { assetsExportTool } from "../features/assets-export/tool.ts";
import { baselineDiffTool } from "../features/baseline-diff/tool.ts";
import { baselineSaveTool } from "../features/baseline-save/tool.ts";
import { breakpointsFindTool } from "../features/breakpoints-find/tool.ts";
import { changesSinceTool } from "../features/changes-since/tool.ts";
import { codeConnectReadTool } from "../features/code-connect-read/tool.ts";
import { componentsReadTool } from "../features/components-read/tool.ts";
import { contrastCheckTool } from "../features/contrast-check/tool.ts";
import { designApplyTool } from "../features/design-apply/tool.ts";
import { designAuditTool } from "../features/design-audit/tool.ts";
import { designLintTool } from "../features/design-lint/tool.ts";
import { designReadTool } from "../features/design-read/tool.ts";
import { effectsApplyTool } from "../features/effects-apply/tool.ts";
import { executeTool } from "../features/execute/tool.ts";
import { fileMapTool } from "../features/file-map/tool.ts";
import { flowReadTool } from "../features/flow-read/tool.ts";
import { fontsCheckTool } from "../features/fonts-check/tool.ts";
import { guideTool } from "../features/guide/tool.ts";
import { iconsInsertTool } from "../features/icons-insert/tool.ts";
import { imageCompareTool } from "../features/image-compare/tool.ts";
import { inspectTool } from "../features/inspect/tool.ts";
import { instancesReattachTool } from "../features/instances-reattach/tool.ts";
import { measureTool } from "../features/measure/tool.ts";
import { nodeShowTool } from "../features/node-show/tool.ts";
import { nodesDeleteTool } from "../features/nodes-delete/tool.ts";
import { nodesDiffTool } from "../features/nodes-diff/tool.ts";
import { nodesFindTool } from "../features/nodes-find/tool.ts";
import { outlineTool } from "../features/outline/tool.ts";
import { screenshotTool } from "../features/screenshot/tool.ts";
import { selectionGetTool } from "../features/selection-get/tool.ts";
import { selectionWaitTool } from "../features/selection-wait/tool.ts";
import { statesFindTool } from "../features/states-find/tool.ts";
import { statusTool } from "../features/status/tool.ts";
import { stylesCompareTool } from "../features/styles-compare/tool.ts";
import { textsReplaceTool } from "../features/texts-replace/tool.ts";
import { tokensApplyTool } from "../features/tokens-apply/tool.ts";
import { tokensBindTool } from "../features/tokens-bind/tool.ts";
import { tokensReadTool } from "../features/tokens-read/tool.ts";
import { tokensUsageTool } from "../features/tokens-usage/tool.ts";
import { variantsReadTool } from "../features/variants-read/tool.ts";
import { versionSaveTool } from "../features/version-save/tool.ts";
import { viewportGetTool } from "../features/viewport-get/tool.ts";
import type { ToolContext } from "../types/mcp.ts";
import { registerContentTool, registerTool } from "./register-tool.ts";

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer(
    {
      name: "pixelwright",
      version: context.version,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  // In this order clients list them: finding and reading first, then the checks, then writing and the rest.
  registerReadTools(server, context);
  registerCheckTools(server, context);
  registerWriteTools(server, context);

  return server;
}

/** The tools that find layers and read them. */
function registerReadTools(server: McpServer, context: ToolContext): void {
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
  registerContentTool(server, screenshotTool(context));
  registerContentTool(server, designReadTool(context));
  registerTool(server, inspectTool(context));
  registerTool(server, nodesDiffTool(context));
  registerTool(server, baselineSaveTool(context));
  registerTool(server, baselineDiffTool(context));
  registerTool(server, breakpointsFindTool(context));
  registerTool(server, imageCompareTool(context));
  registerTool(server, stylesCompareTool(context));
  registerTool(server, measureTool(context));
  registerTool(server, flowReadTool(context));
}

/** The tools that check a design against rules and its scale. */
function registerCheckTools(server: McpServer, context: ToolContext): void {
  registerTool(server, contrastCheckTool(context));
  registerTool(server, fontsCheckTool(context));
  registerTool(server, designAuditTool(context));
  registerTool(server, designLintTool(context));
  registerTool(server, a11yReadTool(context));
  registerTool(server, statesFindTool(context));
  registerTool(server, tokensUsageTool(context));
}

/** The tools that write, and those that read tokens, components and assets; the guide last. */
function registerWriteTools(server: McpServer, context: ToolContext): void {
  registerTool(server, designApplyTool(context), context.support);
  registerTool(server, executeTool(context));
  registerTool(server, tokensReadTool(context));
  registerTool(server, tokensApplyTool(context), context.support);
  registerTool(server, tokensBindTool(context), context.support);
  registerTool(server, textsReplaceTool(context), context.support);
  registerTool(server, instancesReattachTool(context), context.support);
  registerTool(server, effectsApplyTool(context), context.support);
  registerTool(server, iconsInsertTool(context), context.support);
  registerTool(server, versionSaveTool(context), context.support);
  registerTool(server, componentsReadTool(context));
  registerTool(server, variantsReadTool(context));
  registerTool(server, assetsExportTool(context));
  registerTool(server, codeConnectReadTool(context));
  registerTool(server, guideTool());
}
