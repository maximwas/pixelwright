import type { PlannedAsset } from "@pixelwright/core";
import { RASTER_SCALE } from "../constants/mcp.ts";
import { exportBytes, imageBytes } from "../mcp/export-bytes.ts";
import type { BridgeView } from "../types/mcp.ts";

/**
 * A planned asset's bytes from the plugin: the original image by its hash, or a render in the asset's format (rasters
 * at 2x unless it says otherwise). An icon is rendered with everything it draws (centred and outside strokes would be
 * cut off at its box); an image as its own box, its drop shadows and outlines staying CSS around it.
 */
export async function fetchAsset(
  bridge: BridgeView,
  asset: PlannedAsset,
  target: { session: string },
): Promise<Buffer> {
  if (asset.imageHash !== undefined) {
    return imageBytes(bridge, asset.imageHash, target);
  }

  const format = asset.format === "JPG" || asset.format === "SVG" || asset.format === "PDF" ? asset.format : "PNG";
  const { bytes } = await exportBytes(
    bridge,
    {
      node: asset.node,
      format,
      scale: asset.scale ?? (format === "PNG" || format === "JPG" ? RASTER_SCALE : 1),
      effects: asset.kind === "icon",
    },
    { target },
  );

  return bytes;
}
