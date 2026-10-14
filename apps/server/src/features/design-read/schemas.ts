import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

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
