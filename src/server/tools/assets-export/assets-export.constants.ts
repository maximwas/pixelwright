import { EXPORT_SCALE } from "@/shared/ops/export/export.constants.ts";

/** assets_export as clients list it (tools.json pins every word). */
export const ASSETS_EXPORT_TOOL = {
  name: "assets_export",
  title: "Export assets",
  description:
    "Writes files out of the design into dir. nodes: up to 50 layers, one file each (SVG for an icon, PNG at 2x otherwise, or the format and scale given; PDF too; WEBP keeps transparency exactly at any quality, which sets how lossy its colours are, 85 by default). from: every true asset inside one layer, the icons and images design_read would plan. original: the images as they were placed instead of renders (photos at full size, in their own format). Files are named after their layer (Rectangle 61: rectangle-61.png), or as names gives a layer id. The same bytes are written once, a name taken by other bytes gets -2, and a file already in dir is never overwritten with other bytes. A layer that cannot be exported is reported in errors and the rest are still written.",
} as const;

export const ASSETS_EXPORT_FIELD = {
  nodes: "Layers to write, one file each: SVG for an icon, PNG otherwise, unless format says. Give nodes or from.",
  from: "A layer to write every true asset of (its icons and images, as design_read plans them): an image fill behind a layer's content is written as placed, an image layer is rendered as design_read plans it (its export settings, else 2x); scale and format apply to nodes only. Give nodes or from.",
  dir: "The folder to write into; created if missing. Files already there are never overwritten with other bytes. A relative path starts in the project folder: the MCP client's root, else CLAUDE_PROJECT_DIR, else the server's working directory.",
  names:
    'A file name per layer id, e.g. {"54:12": "hero-mountains"}: slugged, the extension added. The other layers are named after themselves (Rectangle 61: rectangle-61.png).',
  format: "For nodes: the format of every file. WEBP is rendered as PNG by Figma and encoded here.",
  scale:
    "For nodes rendered as PNG, JPG or WEBP: pixels per Figma pixel, or per CSS px with width. Default 2. Ignored with from: an image fill behind a layer's content is written as placed, an image layer is rendered at its export settings, else 2x.",
  width:
    "For nodes as PNG, JPG or WEBP: the CSS width the build shows the layer at; the file is width × scale px wide (110 at scale 2: 220 px).",
  quality: "For WEBP: the colours' quality, 1 to 100. Default 85. Transparency is kept exactly at any quality.",
  original:
    "Write the images as they were placed (not cropped, filtered or scaled) instead of renders, with their real format: with nodes, each layer's topmost visible image fill, any others noted. A video fill cannot be exported.",
  planned:
    "The path planned for this layer (its name in names, else as design_read plans it), when the file got another name: use path in its src.",
  kind: "video: the layer is filled with a video, which the Plugin API cannot export.",
} as const;

/** The input's bounds, as 0.7.0 (T-194). */
export const ASSETS_EXPORT = {
  /** Up to 50 layers a call: each is read and rendered on its own. */
  maxNodes: 50,
  nameChars: 200,
  /** A path as long as the file systems take. */
  pathChars: 4_096,
  /** Figma renders at most 4x a layer: 16384 px is 4096 px at 4x, Figma's largest image side. */
  maxWidth: 16_384,
  /** A scale from a CSS width keeps 4 decimals. */
  scaleSteps: 10_000,
} as const;

export const ASSETS_EXPORT_TEXT = {
  nodesOrFrom: "Give nodes or from: the layers to write, or one layer to write the assets of.",
  widthForNodes: "width is for nodes rendered as PNG, JPG or WEBP: one CSS width per layer.",
  tooWide: (
    node: string,
    width: number,
    most: number,
    density: number,
  ) =>
    `${node} is ${width} px wide and Figma renders at most ${EXPORT_SCALE.max}× the layer: ${most} px at ${density}x.`,
  noImage: (node: string) => `${node} has no image fill to take the original of.`,
  otherImages: (node: string, count: number) =>
    `${node} has ${count} other image ${count === 1 ? "fill" : "fills"} besides the topmost visible one, which was written: hidden or covered in Figma.`,
  video: (node: string) =>
    `${node} is filled with a video: video fills cannot be exported through the Plugin API: ask the designer for the file.`,
  renamed: (
    node: string,
    file: string,
    planned: string,
    path: string,
  ) =>
    `${node} is in ${file}, not ${planned} as planned (the same bytes share one file, a name holding other bytes gets -2): use ${path} in its src.`,
  unnamed: (id: string) =>
    `names has ${id}, which is not among the layers exported (files[].node gives their ids): no file took its name.`,
} as const;
