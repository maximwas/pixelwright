import * as z from "zod";
import { ClipSchema, RenderModesSchema } from "../../images/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { RELATIVE_PATHS } from "../../project/constants.ts";

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
    .exactOptional()
    .describe(`The PNG to compare with, e.g. a screenshot of your build at the same size: its path. ${RELATIVE_PATHS}`),
  against: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "Another layer's id to compare with instead of a PNG, rendered the same way: a variant against its default, a rebuilt frame against the original.",
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
  clip: ClipSchema,
  modes: RenderModesSchema,
  diff: z
    .string()
    .min(1)
    .max(4_096)
    .exactOptional()
    .describe(`A .png path to write the difference to: the render faded, every differing pixel red. ${RELATIVE_PATHS}`),
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
