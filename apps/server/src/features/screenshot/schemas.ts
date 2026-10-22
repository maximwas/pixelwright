import * as z from "zod";
import { ClipSchema, RenderModesSchema } from "../../images/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { RELATIVE_PATHS } from "../../project/constants.ts";

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
    .describe(`Write the PNG to this file (any size) instead of returning it. ${RELATIVE_PATHS}`),
  clip: ClipSchema,
  modes: RenderModesSchema,
  file: FileSchema,
});
