import * as z from "zod";
import { MAX_EXPORT_NODES } from "../../constants/mcp.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { RELATIVE_PATHS } from "../../project/constants.ts";

export const AssetsExportInputSchema = z.object({
  nodes: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(MAX_EXPORT_NODES)
    .exactOptional()
    .describe(
      "Layers to write, one file each: SVG for an icon, PNG otherwise, unless format says. Give nodes or from.",
    ),
  from: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "A layer to write every true asset of (its icons and images, as design_read plans them). Give nodes or from.",
    ),
  dir: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      `The folder to write into; created if missing. Files already there are never overwritten with other bytes. ${RELATIVE_PATHS}`,
    ),
  names: z
    .record(z.string().min(1).max(200), z.string().min(1).max(200))
    .exactOptional()
    .describe(
      'A file name per layer id, e.g. {"54:12": "hero-mountains"}: slugged, the extension added. The other layers are named after themselves (Rectangle 61: rectangle-61.png).',
    ),
  format: z
    .enum(["PNG", "JPG", "WEBP", "SVG", "PDF"])
    .exactOptional()
    .describe("For nodes: the format of every file. WEBP is rendered as PNG by Figma and encoded here."),
  scale: z
    .number()
    .min(0.01)
    .max(4)
    .exactOptional()
    .describe("For PNG, JPG and WEBP: pixels per Figma pixel, or per CSS px with width. Default 2."),
  width: z
    .number()
    .positive()
    .max(16_384)
    .exactOptional()
    .describe(
      "For nodes as PNG, JPG or WEBP: the CSS width the build shows the layer at; the file is width × scale px wide (110 at scale 2: 220 px).",
    ),
  quality: z
    .number()
    .int()
    .min(1)
    .max(100)
    .exactOptional()
    .describe("For WEBP: the colours' quality, 1 to 100. Default 85. Transparency is kept exactly at any quality."),
  original: z
    .boolean()
    .default(false)
    .describe(
      "Write the images as they were placed (not cropped, filtered or scaled) instead of renders, with their real format.",
    ),
  file: FileSchema,
});

export const AssetsExportOutputSchema = z.object({
  files: z.array(
    z.object({
      node: z.string(),
      kind: z.enum(["icon", "image"]),
      format: z.string(),
      path: z.string(),
      planned: z
        .string()
        .exactOptional()
        .describe(
          "The path planned for this layer (its name in names, else as design_read plans it), when the file got another name: use path in its src.",
        ),
      bytes: z.number(),
    }),
  ),
  notes: z.array(z.string()),
  errors: z.array(
    z.object({
      node: z.string(),
      message: z.string(),
    }),
  ),
});
