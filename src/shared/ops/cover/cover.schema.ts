import * as zod from "zod/mini";
import { BoxSchema } from "@/shared/ops/selection/selection.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** A region of a layer, in Figma px from its box's top left (before scale). */
export const ClipSchema = zod.object({
  x: zod.number(),
  y: zod.number(),
  width: zod.number().check(zod.positive()),
  height: zod.number().check(zod.positive()),
});

/** Where a clip of a layer is cut from (T-073), measured before anything renders. */
export const CoverInputSchema = zod.strictObject({ node: NodeIdSchema, clip: ClipSchema, effects: zod.boolean() });

/** A layer placed from the clipped layer's box top left, with its own size. */
export const PlacedLayerSchema = zod.object({
  node: zod.string(),
  x: zod.number(),
  y: zod.number(),
  width: zod.number(),
  height: zod.number(),
});

/**
 * The layer's box and what its export covers, in page px (with effects what paints around the box, which may also be
 * less than it, as a text's glyphs are), and the smallest opaque layer inside it that shows the region alone (O-014).
 */
export const CoverOutputSchema = zod.object({ box: BoxSchema, rendered: BoxSchema, cover: PlacedLayerSchema });
