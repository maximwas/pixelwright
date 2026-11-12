import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";

/** A region of a layer to render, as screenshot and image_compare take it. */
export const ClipSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .exactOptional()
  .describe(
    "Only this region of the layer, in Figma px from its box's top left (before scale); with effects on it may reach into what paints around the box.",
  );

/** The variable modes to render a layer in, as screenshot and image_compare take them. */
export const RenderModesSchema = OPERATION_SCHEMAS.export.input.shape.modes.describe(
  'Render in these variable modes, by collection and mode name, e.g. {"Theme": "Dark"}: set on the layer for the render, then set back (needs Allow edits; the file is left as it was).',
);
