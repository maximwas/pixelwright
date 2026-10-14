import type { PlannedAsset } from "@pixelwright/core";
import { RASTER_SCALE } from "../constants/mcp.ts";
import { exportBytes, imageBytes } from "../plugin/export-bytes.ts";
import type { PluginSession } from "../plugin/plugin-session.ts";

/**
 * A planned asset's bytes from the plugin: the original image by its hash, or a render in the asset's format (rasters
 * at 2x unless it says otherwise). An icon is rendered with everything it draws (centred and outside strokes would be
 * cut off at its box); an image as its own box, its drop shadows and outlines staying CSS around it.
 */
export async function fetchAsset(session: PluginSession, asset: PlannedAsset): Promise<Buffer> {
  if (asset.imageHash !== undefined) {
    return imageBytes(session, asset.imageHash);
  }

  const format = asset.format === "JPG" || asset.format === "SVG" || asset.format === "PDF" ? asset.format : "PNG";
  const { bytes } = await exportBytes(session, {
    node: asset.node,
    format,
    scale: asset.scale ?? (format === "PNG" || format === "JPG" ? RASTER_SCALE : 1),
    effects: asset.kind === "icon",
  });

  return bytes;
}
