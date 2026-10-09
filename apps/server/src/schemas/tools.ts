import * as z from "zod";

/** Which connected file a tool works on: its session from status, or its name; the active file when left out. */
export const FileSchema = z
  .string()
  .min(1)
  .max(1_024)
  .exactOptional()
  .describe("The file to work on: its session from status or its name. Default: the active file.");

export const ScreenshotInputSchema = z.object({
  node: z.string().min(1).max(200).describe("The layer's id, e.g. 2:4868."),
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
  file: FileSchema,
});

export const DesignReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer's id, e.g. 2:4868. Default: the one layer selected in Figma."),
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
  file: FileSchema,
});
