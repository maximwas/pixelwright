import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { MAX_EXPORT_NODES } from "../constants/mcp.ts";
import { FileSchema } from "../plugin/file-schema.ts";

export const ScreenshotInputSchema = z.object({
  node: z.string().min(1).max(200).describe("The layer's id, e.g. 54:243."),
  scale: z.number().min(0.01).max(4).default(1).describe("Pixels per Figma pixel: 2 for a sharp look, below 1 to fit."),
  effects: z
    .boolean()
    .default(true)
    .describe("Include shadows and outside strokes around the layer; false renders only its own box."),
  save: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe(
      "Write the PNG to this file (any size) instead of returning it; a relative path is from the server's folder.",
    ),
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .exactOptional()
    .describe(
      "Only this region of the layer, in Figma px from its box's top left (before scale); with effects on it may reach into what paints around the box.",
    ),
  modes: OPERATION_SCHEMAS.export.input.shape.modes.describe(
    'Render in these variable modes, by collection and mode name, e.g. {"Theme": "Dark"}: set on the layer for the render, then set back (needs Allow edits; the file is left as it was).',
  ),
  file: FileSchema,
});

export const DesignReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer's id, e.g. 54:243. Default: the one layer selected in Figma."),
  depth: z.number().int().min(0).max(100).exactOptional().describe("Levels below the layer to read. Default: all."),
  assetsDir: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe(
      "Folder to write the icons (SVG) and images (PNG at 2x, originals for backgrounds) into, e.g. src/assets; the XML's src paths start with it. Without it the assets are only planned.",
    ),
  screenshot: z.boolean().default(false).describe("Also return the layer's image, to compare your build with."),
  maxChars: z
    .number()
    .int()
    .min(2_000)
    .max(400_000)
    .default(80_000)
    .describe("Longest XML to return; deeper branches past it come back empty with $truncated, to read on their own."),
  code: z
    .boolean()
    .default(true)
    .describe(
      "Run the project's Code Connect templates, giving connected instances as $code with their code (default); false reads them as layers.",
    ),
  file: FileSchema,
});

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
      "The folder to write into; created if missing. Files already there are never overwritten with other bytes.",
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
  quality: z.number().int().min(1).max(100).exactOptional().describe("For WEBP: 1 to 100. Default 85."),
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
        .describe("The path design_read plans for this layer, when the file got another name: use path in its src."),
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

export const CodeConnectReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("A layer or page id to look in, e.g. 54:243. Default: the current page."),
  file: FileSchema,
});

const ComponentCountSchema = z.object({
  component: z.string().describe("The Figma component's (or component set's) name."),
  instances: z.number(),
});

export const CodeConnectReadOutputSchema = z.object({
  root: z.string().describe("The project folder the templates were looked for in."),
  templates: z.array(
    z.object({
      path: z.string(),
      url: z.string().optional(),
      component: z.string().optional(),
      matches: z.array(ComponentCountSchema),
      error: z.string().optional().describe("What a trial run on the first instance it matches gave."),
    }),
  ),
  unconnected: z.array(ComponentCountSchema).describe("Components used here that no template connects."),
  problems: z.array(z.string()),
});

const EdgeDiffSchema = z.object({
  matched: z.number(),
  shifted: z.array(
    z.object({
      reference: z.number(),
      node: z.number(),
      by: z.number(),
    }),
  ),
  missing: z.array(z.number()),
  extra: z.array(z.number()),
});

export const ImageCompareInputSchema = z.object({
  node: z.string().min(1).max(200).describe("The layer's id, e.g. 54:243."),
  reference: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      "The PNG to compare with, e.g. a screenshot of your build at the same size: a path, relative to the server's folder or absolute.",
    ),
  scale: z
    .number()
    .min(0.01)
    .max(4)
    .default(1)
    .describe("Pixels per Figma pixel of the render: the reference's density."),
  effects: z
    .boolean()
    .default(true)
    .describe("Render shadows and outside strokes around the layer; false renders only its own box."),
  clip: ScreenshotInputSchema.shape.clip,
  modes: ScreenshotInputSchema.shape.modes,
  diff: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe("A .png path to write the difference to: the render faded, every differing pixel red."),
  file: FileSchema,
});

export const ImageCompareOutputSchema = z.object({
  size: z.object({
    node: z.string(),
    reference: z.string(),
  }),
  scale: z.number(),
  rmse: z.number().describe("Root mean square colour difference, 0 to 255, both images over white."),
  different: z.number().describe("The share of pixels that differ by more than antialiasing does, 0 to 1."),
  box: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable()
    .describe("The box around every differing pixel, in px of the render; null when none differs."),
  rows: EdgeDiffSchema.describe(
    "Horizontal edges by y: matched, shifted (by: + is lower in the render), missing, extra.",
  ),
  columns: EdgeDiffSchema.describe("Vertical edges by x: matched, shifted (by: + is further right in the render)."),
  diff: z.string().exactOptional(),
  note: z.string().exactOptional(),
});
