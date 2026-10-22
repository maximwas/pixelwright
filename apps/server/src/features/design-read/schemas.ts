import { NEARBY_MAX_DISTANCE } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";
import { RELATIVE_PATHS } from "../../project/constants.ts";

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
      `Folder to write the icons (SVG) and images (PNG at 2x, originals for backgrounds) into, e.g. src/assets; the XML's src paths start with it as given. Without it the assets are only planned. ${RELATIVE_PATHS}`,
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
  repeats: z
    .boolean()
    .default(false)
    .describe(
      "Read each run of three or more alike neighbours (list items, cards, table rows) as its first, marked $repeat with the run's length; the JSON's repeats gives each run's layers and the values they hold apart, a row per layer.",
    ),
  nearby: z
    .number()
    .int()
    .min(0)
    .max(NEARBY_MAX_DISTANCE)
    .exactOptional()
    .describe(
      "Also list the designer's notes on the canvas within this many px of the screen holding the layer (texts, stickies, small frames of text beside it or over it), e.g. 400: the JSON's nearby.",
    ),
  file: FileSchema,
});
