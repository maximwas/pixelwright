import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const FontsCheckInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer whose texts' fonts to check (a section, a screen). Default: the one layer selected in Figma."),
  file: FileSchema,
});

export const FontsCheckOutputSchema = z.object({
  summary: z.string(),
  fonts: z.array(
    z.object({
      family: z.string(),
      weights: z.array(z.string()).describe('The weights used, "400 italic" for an italic.'),
      google: z
        .boolean()
        .nullable()
        .describe("Whether Google Fonts serves the family; null when it could not be reached."),
      css: z.string().exactOptional().describe("The Google Fonts css2 link for the weights used."),
      note: z.string().exactOptional(),
    }),
  ),
});
