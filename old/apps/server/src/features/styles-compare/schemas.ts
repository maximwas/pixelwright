import { StyleComparisonSchema } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";
import { STYLE_PAIRS_MAX, STYLE_PROPERTIES_MAX, STYLE_TOLERANCE } from "./constants.ts";

const ComputedStylesSchema = z
  .record(z.string().min(1).max(100), z.string().max(4_000))
  .refine(
    (css) => Object.keys(css).length <= STYLE_PROPERTIES_MAX,
    `css holds at most ${STYLE_PROPERTIES_MAX} properties.`,
  )
  .describe(
    "The computed styles of the element that draws the layer in the build, by property: getComputedStyle's values, background-color or backgroundColor.",
  );

export const StylesCompareInputSchema = z.object({
  pairs: z
    .array(
      z.object({
        node: z.string().min(1).max(200).describe("The layer, by the id design_read gives it, e.g. 54:243."),
        css: ComputedStylesSchema,
        label: z
          .string()
          .min(1)
          .max(200)
          .exactOptional()
          .describe("What draws it in the build (a selector, a component), to tell the results apart."),
      }),
    )
    .min(1)
    .max(STYLE_PAIRS_MAX)
    .describe("Each layer with the build's computed styles for it."),
  tolerance: z
    .number()
    .min(0)
    .max(20)
    .default(STYLE_TOLERANCE)
    .describe(
      "How far a size or a place may be off, in px (1 by default): layout rounds them. Other lengths, colours and numbers compare as CSS computes them.",
    ),
  file: FileSchema,
});

export const StylesCompareOutputSchema = z.object({
  layers: z
    .array(
      StyleComparisonSchema.extend({
        node: z.string(),
        name: z.string(),
        tag: z.string().describe("Its element in design_read: Frame, Text, Icon…"),
        label: z.string().exactOptional(),
      }),
    )
    .describe("Each pair's layer: what matched, what differs, what the build left out, what cannot be compared."),
  missing: z.array(z.string()).describe("Layers the file does not hold."),
  same: z.boolean().describe("The build gave every property the design sets and each one matched (notCompared aside)."),
  notes: z.array(z.string()),
});
