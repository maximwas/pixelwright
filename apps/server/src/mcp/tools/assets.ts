import type { McpServer } from "@modelcontextprotocol/server";
import { exportAssets } from "../../assets/export-assets.ts";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { AssetsExportInputSchema, AssetsExportOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

export function registerAssetsTool(server: McpServer, { bridge, files }: ToolContext): void {
  registerTool(server, {
    name: "assets_export",
    title: "Export assets",
    description:
      "Writes files out of the design into dir. nodes: up to 50 layers, one file each (SVG for an icon, PNG at 2x otherwise, or the format and scale given; PDF too). from: every true asset inside one layer, the icons and images design_read would plan. original: the images as they were placed instead of renders (photos at full size, in their own format). The same bytes are written once, a name taken by other bytes gets -2, and a file already in dir is never overwritten with other bytes. A layer that cannot be exported is reported in errors and the rest are still written.",
    input: AssetsExportInputSchema,
    output: AssetsExportOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => exportAssets(bridge, args, files),
  });
}
