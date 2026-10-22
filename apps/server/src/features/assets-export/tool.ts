import { WebpEncoder } from "../../assets/webp.ts";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { exportAssets } from "./export-assets.ts";
import { AssetsExportInputSchema, AssetsExportOutputSchema } from "./schemas.ts";

export function assetsExportTool({
  plugin,
  files,
}: ToolContext): ToolDefinition<typeof AssetsExportInputSchema, typeof AssetsExportOutputSchema> {
  // One encoder for the server: its wasm is read once.
  const webp = new WebpEncoder();

  return {
    name: "assets_export",
    title: "Export assets",
    description:
      "Writes files out of the design into dir. nodes: up to 50 layers, one file each (SVG for an icon, PNG at 2x otherwise, or the format and scale given; PDF too). from: every true asset inside one layer, the icons and images design_read would plan. original: the images as they were placed instead of renders (photos at full size, in their own format). Files are named after their layer (Rectangle 61: rectangle-61.png), or as names gives a layer id. The same bytes are written once, a name taken by other bytes gets -2, and a file already in dir is never overwritten with other bytes. A layer that cannot be exported is reported in errors and the rest are still written.",
    input: AssetsExportInputSchema,
    output: AssetsExportOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => exportAssets(plugin, args, files, webp),
  };
}
